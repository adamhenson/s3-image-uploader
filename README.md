#s3-image-uploader

[![npm](https://img.shields.io/npm/v/s3-image-uploader.svg)]()
[![npm](https://img.shields.io/npm/dm/s3-image-uploader.svg)]()
[![npm](https://img.shields.io/npm/dt/s3-image-uploader.svg)]()

> A Node.js module for resizing, and uploading files to Amazon S3 with capability to track progress using websockets.
>
> This module was created to use with little setup and customization as it's simply a wrapper of [AWS SDK](http://aws.amazon.com/sdk-for-node-js/) and [gm](https://github.com/aheckmann/gm). This module also utilizes [Websockets](https://github.com/einaros/ws), which can be optionally enabled to allow the server to send the client messages such as file upload completion and upload progress.

## Installation

Install package with NPM and add it to your dependencies.

```
$ npm install s3-image-uploader --save
```

## Dependencies

When you npm install this module - the module dependencies are added ([s3](https://github.com/andrewrk/node-s3-client), [gm](https://github.com/aheckmann/gm), [ws](https://www.npmjs.org/package/ws)), however you'll need to make sure [GraphicsMagick](http://www.graphicsmagick.org/) is installed on your server. GraphicsMagick is the image manipulation library this module uses.

Also, you'll need to pay attention to how you're server handles timeouts.

I used the following code in my Express application to make sure the post didn't timeout:

```javascript
app.post('/post-image', function(req, res, next){

  res.connection.setTimeout(0); // this could take a while
  // code to execute post here

});
```

## Usage

Below is the basic configuration, but you can see [full example code here](https://github.com/adamhenson/example-s3-image-uploader)

### Server Side (Node)

Include the module.

```javascript
var Uploader = require('node-s3-uploader');
```

#### Instantiation
Instantiate the uploader with options. Note that if we didn't want to use websockets functionality - we would add to our options ```websockets : false```.

Also, note that we're using properties of the user [environment](http://nodejs.org/api/process.html#process_process_env), but these could be variables or hard coded if preferred (not ideal for security).

```javascript
var uploader = new Uploader({
  aws : {
    key : process.env.NODE_AWS_KEY,
    secret : process.env.NODE_AWS_SECRET
  },
  websocketServer : server,
  websocketServerPort : 3004,
});
```

#### Resize

Width and height options denote the maximum size for the dimension (will be exact if the other dimension is set to 'auto'... but upsizing will not happen). If not defined or set to 'auto' - the dimension will be resized based on aspect ratio of the other. Aspect ratio is always maintained. If ```square : true``` is set and width/height are equal, the smaller dimension will be sized down and the larger will be trimmed off outside of the center.

```fileId``` is important for the websockets functionality. It's referenced in messages sent to the client about the status. Therefore you may want to use this same identifier as a DOM selector in your client side code (maybe a data attribute) to target visual representations of the messages.

```javascript
uploader.resize({
  fileId : 'someUniqueIdentifier',
  width : 600,
  height : 'auto',
  source : './public/tmp/myoldimage.jpg',
  destination : './public/uploads/mynewimage.jpg'
}, function(destination){
  console.error('resize success - new image here: ', destination);
  // execute success code
}, function(errMsg){
  console.error('unable to resize: ', errMsg);
  // execute error code
});
```

#### Validate File Type

This validates the content type referenced in the header of the file.

```fileId``` is again referenced in messages sent to the client about the status.

```javascript
if(uploader.validateType(file, fileId, ['image/jpeg', 'image/gif', 'image/png'])) {
  console.log('validation passed!');
  // execute success code
}
```

#### Get Exif Data

Get the exif data object.

```javascript
uploader.getExifData(filePath, function(data){

  // normally I'd do something with this... like store it in a database
  console.log('exif data', data);

});
```

#### Get Image Size

Get dimension object from image.
The below code will log something like this: `{ width: 1200, height: 900 }`
This method uses the GraphicsMagick `size` method. Find [more documentation here](http://aheckmann.github.io/gm/docs.html).

```javascript
uploader.getSize(filePath, function(data){

  console.log('image size data', data);

});
```

#### Upload

Upload the file to s3.

```fileId``` is again referenced in messages sent to the client about the status.

```javascript
uploader.upload({
  fileId : 'someUniqueIdentifier',
  bucket : 'somebucket',
  source : './public/tmp/myoldimage.jpg',
  name : 'mynewimage.jpg'
},
function(data){ // success
  console.log('upload success:', data);
  // execute success code
},
function(errMsg){ //error
  console.error('unable to upload: ' + errMsg);
  // execute error code
});
```

#### Delete

Delete an array of files from AWS (array can include only one file if desired).

```javascript
uploader.delete('somebucket', ['cat.jpg', 'dog.png', 'turtle.gif'], function(data){
  console.log('yay!', data);
}, function(err){
  console.log('fail!', err);
});
```

## Options

### new Uploader
* @param {object} options - Configuration object. Required.
  * {object} options.aws - aws object. Required.
  * {string} options.aws.key - aws key string. Required.
  * {string} options.aws.secret - aws secret string. Required.
  * {object} options.websocketServer - WebSocket server object. Optional.
  * {number} options.websocketServerPort - WebSocket server port. Optional.
  * {object} options.s3Params - object that can extend the S3 parameters listed here http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html. Optional. Example: `s3Params : { 'CacheControl' : 'max-age=3600'}`

### resize
* @param {object} options - Configuration object. Required.
  * {string} options.fileId - Used to uniquely identify file. Required.
  * {number || 'auto'} options.width - Maximum width allowed for resized image. Otherwise if not defined or set to 'auto' - width will be resized based on aspect ratio of height. Optional. Default is 'auto'.
  * {number || 'auto'} options.height - Maximum height allowed for resized image. Otherwise if not defined or set to 'auto' - height will be resized based on aspect ratio of width. Optional. Default is 'auto'.
  * {string} options.source - Path to the image to be resized. Required.
  * {string} options.destination - Path to new image after resize. Required.
  * {number} options.quality - Quality for resized image (1-100... 100 is best). Optional. Default is 100.
  * {boolean} options.square - boolean flag set to true if the image needs to be square. Optional. Default is false.
  * {boolean} options.noProfile - boolean flag set to true if exif data should be removed (minimizing file size). Optional. Default is true.
  * {number || boolean} options.maxFileSize - can be a number or boolean false. The number represents file size in MegaBytes. Optional. Default is false.
* @param {function} successCallback - Callback function. Receives one argument - {string} path to resized file. Required.
* @param {function} errorCallback - Callback function. Receives one argument - {string} error message. Required.

### validateType
* @param {object} file - Post object. Required.
* @param {string} id - Used to uniquely identify file. Required.
* @param {array} types - Array of string file content types (example: ['image/jpeg', 'image/gif', 'image/png']). Required.

### getExifData
* @param {string} source - Path of image. Required.
* @param {function} callback - Callback that receives argument of false or data object. Required.

### getSize
* @param {string} source - Path of image. Required.
* @param {function} callback - Callback that receives argument of false or data object. Required. The received data object will be in a format similar to this: `{ width: 1200, height: 900 }`

### upload
* @param {object} options - Configuration object. Required.
  * {string} options.fileId - Used to uniquely identify file. Required.
  * {string} options.bucket - S3 bucket. Required.
  * {string} options.source - Path to the image to be uploaded. Required.
  * {string} options.name - Name to be used for new file uploaded to S3. Required.
  * {number || boolean} options.maxFileSize - can be a number or boolean false. The number represents file size in MegaBytes. Optional. Default is false.
* @param {function} successCallback - Callback function. Receives one argument - {object} status object. Required.
* @param {function} errorCallback - Callback function. Receives one argument - {object} error stack trace. Required.

### delete
* @param {string} bucket - AWS bucket name. Required.
* @param {array} fileNames - Array of string filenames (example: ['cat.jpg', 'dog.png', 'turtle.gif']). Required.
* @param {function} successCallback - Callback that receives data object. Required.
* @param {function} errorCallback - Callback that receives error object. Optional.

## On the Client Side

Please see a [full example here](https://github.com/adamhenson/example-s3-image-uploader/blob/master/public/js/uploader.js).

The most important thing to consider here is that we're receiving ```fileId``` from the server as ```id``` to uniquely identify the upload. We receive message objects via websockets. Below are examples of different messages we might receive on the client.

> Error message

```javascript
{
  type : 'error',
  id : 'someUniqueIdentifier',
  message : 'There was a problem uploading this file.'
}
```

> Upload progress message

```javascript
{
  type : 'progress',
  id : 'someUniqueIdentifier',
  progressAmount : 5276653, // represents bytes
  progressTotal : 6276653 // represents bytes
}
```

> Upload success message

```javascript
{
  type : 'result',
  id : 'someUniqueIdentifier',
  path : '/mybucket/myimage.jpg'
}
```

> Resize success message

```javascript
{
  type : 'resize',
  id : 'someUniqueIdentifier',
  size : '100x100'
}
```

So, a simple implementation of this might look something like this.

Make the websocket connection.

```javascript
var host = window.document.location.host.replace(/:.*/, '');
var ws = new WebSocket('ws://' + host + ':8080');
```

Handle messages from the server about the progress of our upload/s and resizing.

```javascript
ws.onmessage = function(event){
  var message = JSON.parse(event.data);
  if(typeof message.type !== 'undefined') {
    if(message.type === 'progress') // execute code for progress
    else if(message.type === 'result') // execute code for result
    else if(message.type === 'resize') // execute code for resize status
    else if(message.type === 'error') // execute code for error messages
  }
};
```