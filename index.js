'use strict';

var WebSocketServer = require('ws').Server;

var Uploader = function(options) {
  this.options = options;
};

module.exports = Uploader;