'use strict';

// WS - A Websocket library: https://www.npmjs.org/package/ws
var WebSocketServer = require('ws').Server;
// Let's not re-invent the wheel. A high level S3 uploader: https://www.npmjs.org/package/s3
var s3 = require('s3');
// GraphicsMagick - For image manipulation: https://github.com/aheckmann/gm
var gm = require('gm');

/**
 * Uploader constructor.
 * @param {object} options - Configuration object. Required.
 *  {object} options.server - Server object. Required.
 *  {object} options.aws - aws object. Required.
 *  {string} options.aws.key - aws key string. Required.
 *  {string} options.aws.secret - aws secret string. Required.
 *  {boolean} options.websockets - boolean used to enable websockets (enabled is true). Optional. Default is true.
 */
var Uploader = function(options){

  var self = this;

  if(typeof options.server === 'undefined') throw new Error('Uploader: "server" is not defined.');
  if(typeof options.aws.key === 'undefined') throw new Error('Uploader: "aws.key" is not defined.');
  if(typeof options.aws.secret === 'undefined') throw new Error('Uploader: "aws.secret" is not defined.');

  self.options = options;

  // websockets
  self.ws = false; // initially
  if(options.websockets){
    var ws = new WebSocketServer({ server: self.options.server });
    ws.on('connection', function(ws) {
      self.ws = ws;
    });
  }

  // create the s3 client
  self.client = s3.createClient({
    s3Options: {
      accessKeyId: self.options.aws.key,
      secretAccessKey: self.options.aws.secret
    }
  });

};

/**
 * Resize image and add to destination directory.
 * @param {object} options - Configuration object. Required.
 * @param {function} successCallback - Callback function. Receives one argument - {string} path to resized file. Required.
 * @param {function} errorCallback - Callback function. Receives one argument - {string} error message. Required.
 *  {string} options.fileId - Used to uniquely identify file. Required.
 *  {number} options.width - Maximum width allowed for resized image. Required.
 *  {number} options.height - Maximum height allowed for resized image. Required.
 *  {string} options.source - Path to the image to be resized. Required.
 *  {string} options.destination - Path to new image after resize. Required.
 *  {number} options.quality - Quality for resized image (1-100... 100 is best). Optional. Default is 100.
 *  {boolean} options.square - boolean flag set to true if the image needs to be square. Optional. Default is false.
 *  {boolean} options.noProfile - boolean flag set to true if exif data should be removed (minimizing file size). Optional. Default is true.
 *  {number || boolean} options.maxFileSize - can be a number or boolean false. The number represents file size in MegaBytes. Optional. Default is false.
 */
Uploader.prototype.resize = function(options, successCallback, errorCallback){

  if(typeof options.fileId === 'undefined') throw new Error('Uploader.resize: "fileId" is not defined.');
  if(typeof options.width === 'undefined') throw new Error('Uploader.resize: "width" is not defined.');
  if(typeof options.height === 'undefined') throw new Error('Uploader.resize: "height" is not defined.');
  if(typeof options.source === 'undefined') throw new Error('Uploader.resize: "source" is not defined.');
  if(typeof options.destination === 'undefined') throw new Error('Uploader.resize: "destination" is not defined.');
  // defaults
  if(typeof options.quality === 'undefined') options.quality = 100;
  if(typeof options.square === 'undefined') options.square = false;
  if(typeof options.noProfile === 'undefined') options.noProfile = true;
  if(typeof options.maxFileSize === 'undefined') options.maxFileSize = false; // unlimited by default

  var self = this;

  // get image size and execute callback
  imageSize_(options.source, function(err, size){

    var startResize_ = function(){
      resize_(options, size, function(img, destination){
        var status = {
          type : 'resize',
          id : options.fileId,
          size : options.width + 'x' + options.height
        };
        if(self.ws){
          self.ws.send(JSON.stringify(status), function(error) {
            if(error) console.log("WS send error:", error);
          });
        }
        successCallback.call(img, destination);
      }, errorCallback);
    };

    // if maxFileSize is set - get the filesize info and validate
    if(options.maxFileSize){
      imageFileSize_(options.source, function(err, fileSize){
        // if 'M' is found then we know it's bigger than 1 mb.
        // if it's less than 1 mb then we just start resize.
        if(fileSize.indexOf('M') !== -1) {
          var fileSize = parseFloat(fileSize.replace('M', ''));
          if(options.maxFileSize < fileSize) {
            var message = 'File is larger than the allowed size of ' + options.maxFileSize + ' MB.';
            errorCallback.call(this, message);
            var status = {
              type : 'error',
              id : options.fileId,
              message : message
            };
            if(self.ws){
              self.ws.send(JSON.stringify(status), function(error) {
                if(error) console.log("WS send error:", error);
              });
            }
          } else {
            startResize_();
          }
        } else {
          startResize_();
        }
      });
    }
    else {
      startResize_();
    }

  });

};

/**
 * Upload to S3.
 * @param {object} options - Configuration object. Required.
 * @param {function} successCallback - Callback function. Receives one argument - {object} status object. Required.
 * @param {function} errorCallback - Callback function. Receives one argument - {object} error stack trace. Required.
 *  {string} options.fileId - Used to uniquely identify file. Required.
 *  {string} options.bucket - S3 bucket. Required.
 *  {string} options.source - Path to the image to be uploaded. Required.
 *  {string} options.name - Name to be used for new file uploaded to S3. Required.
 */
Uploader.prototype.upload = function(options, successCallback, errorCallback){

  if(typeof options.fileId === 'undefined') throw new Error('Uploader.upload: "fileId" is not defined.');
  if(typeof options.bucket === 'undefined') throw new Error('Uploader.upload: "bucket" is not defined.');
  if(typeof options.source === 'undefined') throw new Error('Uploader.upload: "source" is not defined.');
  if(typeof options.name === 'undefined') throw new Error('Uploader.upload: "name" is not defined.');
  if(typeof successCallback === 'undefined') throw new Error('Uploader.upload: "successCallback" is not defined.');
  if(typeof errorCallback === 'undefined') throw new Error('Uploader.upload: "errorCallback" is not defined.');

  var self = this;

  var params = {
    localFile: options.source,
    s3Params: {
      ACL : (typeof options.acl !== 'undefined') ? options.acl : 'public-read',
      Bucket: options.bucket,
      Key: options.name
    }
  };

  var uploader = this.client.uploadFile(params);

  // when there is progress send a message through our websocket connection
  uploader.on('progress', function(){
    var status = {
      type : 'progress',
      id : options.fileId,
      progressAmount : uploader.progressAmount,
      progressTotal : uploader.progressTotal
    };
    if(self.ws){
      self.ws.send(JSON.stringify(status), function(error) {
        if(error) console.log("WS send error:", error);
      });
    }
  });

  // on upload error call error callback
  uploader.on('error', function(err){
    var status = {
      type : 'error',
      id : options.fileId,
      message : 'There was a problem uploading this file.'
    };
    if(self.ws){
      self.ws.send(JSON.stringify(status), function(error) {
        if(error) console.log("WS send error:", error);
      });
    }
    errorCallback.call(uploader, err.stack);
  });

  // when the upload has finished call the success callback and send a message through our websocket
  uploader.on('end', function(obj){
    var status = {
      type : 'result',
      id : options.fileId,
      path : '/' + options.bucket + '/' + options.name
    };
    if(self.ws){
      self.ws.send(JSON.stringify(status), function(error) {
        if(error) console.log("WS send error:", error);
      });
    }
    successCallback.call(uploader, status);
  });

};

/**
 * Get the Exif data of a file.
 * @param {string} source - Path of image. Required.
 * @param {function} callback - Callback that receives argument of false or data object. Required.
 */
Uploader.prototype.getExifData = function(source, callback){

  gm(source)
    .identify(function (dataErr, data) {
      if (!dataErr) {
        callback.call(this, data);
      } else { // no exif data
        callback.call(this, false);
      }
    });

};

/**
 * Validate file type and return boolean of validity.
 * @param {object} file - Post object. Required.
 * @param {string} id - Used to uniquely identify file. Required.
 * @param {array} types - Array of string file content types (example: ['image/jpeg', 'image/gif', 'image/png']). Required.
 */
Uploader.prototype.validateType = function(file, id, types){

  var self = this;
  var valid = false;
  
  var contentType = file.headers['content-type'];
  for(var i in types) {
    if(types[i] === contentType) {
      valid = true;
      break;
    }
  }

  if(!valid) {
    var status = {
      type : 'error',
      id : id,
      message : "The file isn't a valid type."
    };
    if(self.ws){
      self.ws.send(JSON.stringify(status), function(error) {
        if(error) console.log("WS send error:", error);
      });
    }
  }

  return valid;

};

// Get image file size and call callback function
var imageFileSize_ = function(source, callback){

  if(typeof source === 'undefined') throw new Error('imageFileSize_: "source" is not defined.');
  if(typeof callback === 'undefined') throw new Error('imageFileSize_: "callback" is not defined.');
  gm(source).filesize(function(err, value){
    callback.call(this, err, value);
  });

};

// Get image size and call callback function
// Callback returns width and height properties
var imageSize_ = function(source, callback){

  if(typeof source === 'undefined') throw new Error('imageSize_: "source" is not defined.');
  if(typeof callback === 'undefined') throw new Error('imageSize_: "callback" is not defined.');
  gm(source).size(function(err, value){
    callback.call(this, err, value);
  });

};

// Write image to directory
var writeImage_ = function(img, options, successCallback, errorCallback){

  img.write(options.destination, function(uploadErr){
    if(!uploadErr) {
      successCallback.call(img, options.destination);
    } else {
      var status = {
        type : 'error',
        id : options.fileId,
        message : 'There was a problem writing the image.'
      };
      if(self.ws){
        self.ws.send(JSON.stringify(status), function(error) {
          if(error) console.log("WS send error:", error);
        });
      }
      errorCallback.call(img, uploadErr);
    }
  });

};

// Resize image - depends on size and options
var resize_ = function(options, size, successCallback, errorCallback){

  var img = gm(options.source);

  var newWidth = options.width;
  var newHeight = options.height;

  // if this needs to be square
  if(options.square && options.width === options.height) {

    // if we have size info
    if(typeof size !== 'undefined') {
      // if the width is more than height we make it null so that
      // we pass the height to be used by gm, so the outcome
      // is an image with a height set to the max
      // and the width is the aspect ratio adjusted... but will be bigger,
      // and then the gm crop method trims off the width overage.
      // the same would occur in vice versa if height is bigger than width.
      if(size.width >= size.height) newWidth = null;
      else newHeight = null;
    }

    img
      .resize(newWidth, newHeight)
      .gravity('Center')
      .crop(options.width, options.height, 0, 0)
      .quality(options.quality);

  } else { // else it doesn't need to be square

    // if we have size info
    if(typeof size !== 'undefined') {
      // if the the image width is larger than height... else height is larger
      if(size.width >= size.height){
        // if new height is less than options.height - we're good and we use options.width
        // as the max value pass to the gm resize function...
        if((size.height / size.width) * options.width <= options.height) newHeight = null;
        // ...else we use options.height as the max value to pass into the gm resize
        else newWidth = null
      } else {
        // same logic as if block... just reversed
        if((size.width / size.height) * options.height <= options.width) newWidth = null;
        else newHeight = null
      }
    }

    img.resize(newWidth, newHeight);

  }

  img
    .quality(options.quality)
    .autoOrient();

  if(options.noProfile) img.noProfile();

  writeImage_(img, options, successCallback, errorCallback);

};

module.exports = Uploader;