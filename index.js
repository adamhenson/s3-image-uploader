'use strict';

var WebSocketServer = require('ws').Server;
var s3 = require('s3');

var Uploader = function(options){

	if(typeof options.server === 'undefined') throw new Error('Uploader: "server" is not defined.');
	if(typeof options.accessKeyId === 'undefined') throw new Error('Uploader: "accessKeyId" is not defined.');
	if(typeof options.secretAccessKey === 'undefined') throw new Error('Uploader: "secretAccessKey" is not defined.');

	this.options = options;

	// create the s3 client
	this.client = s3.createClient({
		s3Options: {
			accessKeyId: this.options.accessKeyId,
			secretAccessKey: this.options.secretAccessKey
		},
	});

};

Uploader.prototype.upload = function(bucket, localFile, remoteFile, successCallback, errorCallback){

	var params = {
		localFile: localFile,
		s3Params: {
			Bucket: bucket,
			Key: remoteFile
		}
	};

	var uploader = this.client.uploadFile(params);
	var wss = new WebSocketServer({ server: this.options.server });

	wss.on('connection', function(ws){
		uploader.on('progress', function(){
			var progress = {
				progressAmount : uploader.progressAmount,
				progressTotal : uploader.progressTotal
			};
			ws.send(JSON.stringify(progress));
		});
	});

	uploader.on('error', function(err) {
		errorCallback.call(uploader, err.stack);
	});

	uploader.on('end', function(url) {
		successCallback.call(uploader, url);
	});

};

module.exports = Uploader;