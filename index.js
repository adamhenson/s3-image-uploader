'use strict';

// ws - A Websocket library: https://www.npmjs.org/package/ws
var WebSocketServer = require('ws').Server;
// Let's not re-invent the wheel. A high level S3 uploader: https://www.npmjs.org/package/s3
var s3 = require('s3');
// gm (GraphicsMagick) - For image manipulation: https://github.com/aheckmann/gm
var gm = require('gm');
// other helper requires below
var extend = require('extend');

/**
 * Websocket constructor.
 * @param {object} options - Object for options. Required.
 */
function Websocket(options){
  // the default ws connection object
  this.ws = {
    readyState : 0
  };
  // more defaults and options
  this.wss = false;
  this.server = options.websocketServer;
  this.port = (options.port)
    ? options.port
    : false;
  this.log = (options.log)
    ? options.log
    : false;
};

/**
 * Start the WebSocket connection.
 */
Websocket.prototype.start = function(){

  var self = this;
  var options = {
    'server' : self.server,
  };
  if(self.port) options.port = self.port;
  if(!self.wss) self.wss = new WebSocketServer(options);

  // bind to the connection event
  self.wss.on('connection', function connection(ws) {
    if(self.log) console.log('s3-image-uploader: Websocket: websocket connected');
    ws.on('close', function close() {
      if(self.log) console.log('s3-image-uploader: Websocket: websocket disconnected');
    });
    // assign the connection object to the instance
    self.ws = ws;
  });

};

/**
 * Send message to client
 * @param {object || string || boolean} message - Message to send to client. Required.
 * @param {function} callback - Callback function.
 */
Websocket.prototype.send = function(message, callback){

  var self = this;

  // if the connection is open (readyState 1) - send messages
  if(self.ws.readyState === 1) {
    self.ws.send(message, function sendError(err){
      if(typeof err !== 'undefined') console.log('s3-image-uploader: Websocket.send: ws send error.', err.stack); 
      if(typeof callback !== 'undefined') callback();
    });
  } else {
    if(typeof callback !== 'undefined') callback();
  }

};

/**
 * Uploader constructor.
 * @param {object} options - Configuration object. Required.
 *  {object} options.aws - aws object. Required.
 *  {string} options.aws.key - aws key string. Required.
 *  {string} options.aws.secret - aws secret string. Required.
 *  {object} options.websocketServer - WebSocket server object. Optional.
 *  {number} options.websocketServerPort - WebSocket server port. Optional.
 */
var Uploader = function(options){

  var self = this;

  if(typeof options.aws.key === 'undefined') throw new Error('s3-image-uploader: Uploader: "aws.key" is not defined.');
  if(typeof options.aws.secret === 'undefined') throw new Error('s3-image-uploader: Uploader: "aws.secret" is not defined.');
  // default
  if(typeof options.port === 'undefined') options.port = false;
  if(typeof options.websocketServerPort === 'undefined') options.websocketServerPort = false;
  if(typeof options.log === 'undefined') options.log = true;

  self.options = options;
  // support older versions of this module
  if(options.server) self.options.websocketServer = options.server;
  if(options.port) self.options.websocketServerPort = options.port;

  // websockets
  if(self.options.websocketServer) {
    var webSocketOptions = {
      'server' : self.options.websocketServer,
    };
    if(self.options.websocketServerPort) webSocketOptions.port = self.options.websocketServerPort;
    if(self.options.log) webSocketOptions.log = self.options.log;
    self.ws = new Websocket(webSocketOptions);
    self.ws.start();
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
 *  {number || 'auto'} options.width - Maximum width allowed for resized image. Otherwise if not defined or set to 'auto' - width will be resized based on aspect ratio of height. Optional. Default is 'auto'.
 *  {number || 'auto'} options.height - Maximum height allowed for resized image. Otherwise if not defined or set to 'auto' - height will be resized based on aspect ratio of width. Optional. Default is 'auto'.
 *  {string} options.source - Path to the image to be resized. Required.
 *  {string} options.destination - Path to new image after resize. Required.
 *  {number} options.quality - Quality for resized image (1-100... 100 is best). Optional. Default is 100.
 *  {boolean} options.square - boolean flag set to true if the image needs to be square. Optional. Default is false.
 *  {boolean} options.noProfile - boolean flag set to true if exif data should be removed (minimizing file size). Optional. Default is true.
 *  {number || boolean} options.maxFileSize - can be a number or boolean false. The number represents file size in MegaBytes. Optional. Default is false.
 */
Uploader.prototype.resize = function(options, successCallback, errorCallback){

  if(typeof options.fileId === 'undefined') throw new Error('s3-image-uploader: Uploader.resize: "fileId" is not defined.');
  if(typeof options.source === 'undefined') throw new Error('s3-image-uploader: Uploader.resize: "source" is not defined.');
  if(typeof options.destination === 'undefined') throw new Error('s3-image-uploader: Uploader.resize: "destination" is not defined.');
  // defaults
  if(typeof options.width === 'undefined') options.width = 'auto';
  if(typeof options.height === 'undefined') options.height = 'auto';
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
          self.ws.send(JSON.stringify(status), function(){
            successCallback(destination);
          });
        } else {
          successCallback(destination);
        }

      }, errorCallback);

    };

    // if maxFileSize is set - get the filesize info and validate
    if(options.maxFileSize){

      validateImageFileSize_(options, startResize_, function(message){

        var status = {
          type : 'error',
          id : options.fileId,
          message : message
        };

        if(self.ws){
          self.ws.send(JSON.stringify(status), function(){
            errorCallback(message);
          });
        } else {
          errorCallback(message);
        }

      });

    } else {

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
 *  {number || boolean} options.maxFileSize - can be a number or boolean false. The number represents file size in MegaBytes. Optional. Default is false.
 */
Uploader.prototype.upload = function(options, successCallback, errorCallback){

  if(typeof options.fileId === 'undefined') throw new Error('s3-image-uploader: Uploader.upload: "fileId" is not defined.');
  if(typeof options.bucket === 'undefined') throw new Error('s3-image-uploader: Uploader.upload: "bucket" is not defined.');
  if(typeof options.source === 'undefined') throw new Error('s3-image-uploader: Uploader.upload: "source" is not defined.');
  if(typeof options.name === 'undefined') throw new Error('s3-image-uploader: Uploader.upload: "name" is not defined.');
  if(typeof successCallback === 'undefined') throw new Error('s3-image-uploader: Uploader.upload: "successCallback" is not defined.');
  if(typeof errorCallback === 'undefined') throw new Error('s3-image-uploader: Uploader.upload: "errorCallback" is not defined.');

  var self = this;

  var params = {
    localFile: options.source,
    s3Params: {
      ACL : (typeof options.acl !== 'undefined') ? options.acl : 'public-read',
      Bucket: options.bucket,
      Key: options.name
    }
  };

  // if more s3 params are set, extend the object
  if(options.s3Params) params.s3Params = extend(params.s3Params, options.s3Params);

  var initialize_ = function(){

    var uploader = self.client.uploadFile(params);

    // when there is progress send a message through our websocket connection
    uploader.on('progress', function(){
      var status = {
        type : 'progress',
        id : options.fileId,
        progressAmount : uploader.progressAmount,
        progressTotal : uploader.progressTotal
      };
      if(self.ws) self.ws.send(JSON.stringify(status));
    });

    // on upload error call error callback
    uploader.on('error', function(err){
      var errorMessage = 'There was a problem uploading this file.';
      var status = {
        type : 'error',
        id : options.fileId,
        message : errorMessage
      };
      if(self.ws){
        self.ws.send(JSON.stringify(status), function(){
          errorCallback(errorMessage);
        });
      } else {
        errorCallback(errorMessage);
      }
    });

    // when the upload has finished call the success callback and send a message through our websocket
    uploader.on('end', function(obj){
      var status = {
        type : 'result',
        id : options.fileId,
        path : '/' + options.bucket + '/' + options.name
      };
      if(self.ws){
        self.ws.send(JSON.stringify(status), function(){
          successCallback(status);
        });
      } else {
        successCallback(status);
      }
    });

  };

  // if maxFileSize is set - get the filesize info and validate
  if(options.maxFileSize){

    validateImageFileSize_(options, function(){

      initialize_();

    }, function(message){

      var status = {
        type : 'error',
        id : options.fileId,
        message : message
      };

      if(self.ws){
        self.ws.send(JSON.stringify(status), function(){
          successCallback(status);
        });
      } else {
        successCallback(status);
      }

    });

  } else {

    initialize_();

  }

};

/**
 * Delete an array of files (array can include only one file if desired).
 * @param {string} bucket - AWS bucket. Required.
 * @param {array} fileNames - Array of string filenames (example: ['cat.jpg', 'dog.png', 'turtle.gif']). Required.
 * @param {function} successCallback - Callback that receives data object. Required.
 * @param {function} errorCallback - Callback that receives error object. Optional.
 */
Uploader.prototype.delete = function(bucket, fileNames, successCallback, errorCallback){

  var self = this;
  var objects = [];

  fileNames.forEach(function(fileName){
    objects.push({ 'Key' : fileName });
  });

  var s3Params = {
    Bucket : bucket,
    Delete : {
      Objects : objects
    }
  };

  var deleter = self.client.deleteObjects(s3Params);

  deleter.on('error', function(err){
    if (errorCallback) errorCallback(err);
  });

  deleter.on('end', function(obj){
    successCallback(obj);
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
 * Get the size of an image.
 * @param {string} source - Path of image. Required.
 * @param {function} callback - Callback that receives argument of false or data object. Required.
 */
Uploader.prototype.getSize = function(source, callback){

  gm(source)
    .size(function (dataErr, data) {
      if (!dataErr) {
        callback.call(this, data);
      } else { // no size data
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
  
  var contentType = (!file.headers || !file.headers['content-type'])
    ? false
    : file.headers['content-type'];

  // Sometimes mimetype. TODO: Research this more
  if(!contentType && file.mimetype) contentType = file.mimetype;

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
      self.ws.send(JSON.stringify(status));
    }
  }

  return valid;

};

// Get image file size and call callback function
var validateImageFileSize_ = function(options, successCallback, errorCallback){

  gm(options.source).filesize(function(err, fileSize){

    var validate_ = function(size){
      if(options.maxFileSize < size) {
        var message = 'File is larger than the allowed size of ' + options.maxFileSize + ' MB.';
        errorCallback.call(this, message);
      } else {
        successCallback.call(this);
      }
    };

    if(err){

      errorCallback.call(this, err);

    } else {

      if(fileSize.indexOf('M') !== -1) {
        var fileSize = fileSize.replace('M', '');
        validate_(fileSize);
      } else if(fileSize.indexOf('K') !== -1){
        var fileSize = fileSize.replace('K', '');
        fileSize = parseFloat(fileSize/1024).toFixed(2);
        validate_(fileSize);
      } else if(fileSize.indexOf('G') !== -1){
        var fileSize = fileSize.replace('G', '');
        fileSize = parseFloat(fileSize*1024).toFixed(2);
        validate_(fileSize);
      } else {
        successCallback.call(this);
      }

    }

  });

};

// Get image size and call callback function
// Callback returns width and height properties
var imageSize_ = function(source, callback){

  gm(source).size(function(err, value){
    callback.call(this, err, value);
  });

};

// Write image to directory
var writeImage_ = function(img, options, successCallback, errorCallback){

  img.write(options.destination, function(uploadErr){
    if(!uploadErr) successCallback.call(this, img, options.destination);
    else errorCallback.call(this, img, uploadErr);
  });

};

// Resize image - depends on size and options
var resize_ = function(options, size, successCallback, errorCallback){

  var img = gm(options.source);

  var newWidth = options.width;
  var newHeight = options.height;

  // if width or height dimension is unspecified
  if(options.width === 'auto' || options.height === 'auto') {

    if(options.width === 'auto') newWidth = null;
    if(options.height === 'auto') newHeight = null;

    img.resize(newWidth, newHeight);

  } else if(options.square && options.width === options.height) { // if this needs to be square

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