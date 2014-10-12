'use strict';

var WebSocketServer = require('ws').Server;
var s3 = require('s3');

var Uploader = function(options){

	if(typeof options.server === 'undefined') throw new Error('Uploader: "server" is not defined.');
	if(typeof options.aws.key === 'undefined') throw new Error('Uploader: "aws.key" is not defined.');
	if(typeof options.aws.secret === 'undefined') throw new Error('Uploader: "aws.secret" is not defined.');

	this.options = options;

	// create the s3 client
	this.client = s3.createClient({
		s3Options: {
			accessKeyId: this.options.aws.key,
			secretAccessKey: this.options.aws.secret
		}
	});

};

Uploader.prototype.websocket = function(){

  var self = this;
  var ws = new WebSocketServer({ server: self.options.server });
  self.ws = false;

  ws.on('connection', function(ws) {
    self.ws = ws;
    console.log('ws connected');
  });

};

Uploader.prototype.upload = function(fileId, bucket, localFile, remoteFile, successCallback, errorCallback){

  var self = this;

	var params = {
		localFile: localFile,
		s3Params: {
      ACL : (typeof this.options.aws.acl !== 'undefined') ? this.options.aws.acl : 'public-read',
			Bucket: bucket,
			Key: remoteFile
		}
	};

	var uploader = this.client.uploadFile(params);

  uploader.on('progress', function(){
    var progress = {
      type : 'progress',
      id : fileId,
      progressAmount : uploader.progressAmount,
      progressTotal : uploader.progressTotal
    };
    if(self.ws){
      self.ws.send(JSON.stringify(progress), function(error) {
        if(error) console.log("WS send error:", error);
      });
    }
  });

  uploader.on('error', function(err) {
    errorCallback.call(uploader, err.stack);
  });

  uploader.on('end', function(obj) {
    var result = {
      type : 'result',
      id : fileId,
      path : '/' + bucket + '/' + remoteFile
    };
    successCallback.call(uploader, result);
    if(self.ws){
      self.ws.send(JSON.stringify(result), function(error) {
        if(error) console.log("WS send error:", error);
      });
    }
  });

};

module.exports = Uploader;