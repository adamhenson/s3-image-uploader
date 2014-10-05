'use strict';

var WebSocketServer = require('ws').Server;
var s3 = require('s3');

var Uploader = function(options){
  if(typeof options.server === 'undefined') throw new Error('Uploader: server is not defined.');
  this.options = options;
};

Uploader.prototype.upload = function(){

};

module.exports = Uploader;