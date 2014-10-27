#s3-image-uploader

> A Node.js module for resizing, and uploading files to Amazon S3 with capability to track progress using websockets.
>
> This module was created to use with little setup and customization as it's merely a wrapper of the [AWS SDK](http://aws.amazon.com/sdk-for-node-js/) and [gm](https://github.com/aheckmann/gm). This module also utilizes [Websockets](https://github.com/einaros/ws), which can be optionally enabled to allow the server to send the client messages such as file upload completion and upload progress.

## Installation

Install package with NPM and add it to your dependencies ([ws](https://www.npmjs.org/package/ws))

```
$ npm install s3-image-uploader --save
```

## Dependencies

When you npm install this module - you also install the depencies (

## Usage

### Grunt

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```javascript
grunt.loadNpmTasks('mongobackup');
```

Configure via `grunt.initConfig()`.

```javascript
grunt.initConfig({
  mongobackup: {
    dump : {
      options: {
        host : 'localhost',
        out : './dumps/mongo'
      }
    },
    restore: {
      options: {
        host : 'localhost',
        drop : true,
        path : './dumps/mongo/testdb'
      }
    }
  }
});
```

Then run:

```
$ grunt mongobackup:dump
```

Or:

```
$ grunt mongobackup:restore
```

### Gulp

```javascript
var mongobackup = require('mongobackup');

// mongodump - dump all databases on localhost
gulp.task('mongodump', function() {
  mongobackup.dump({
    host : 'localhost',
    out : './dumps/mongo'
  });
});

// mongorestore - restore 'testdb' database to localhost
gulp.task('mongorestore', function() {
  mongobackup.restore({
    host : 'localhost',
    drop : true,
    path : './dumps/mongo/testdb'
  });
});
```

Then run:

```
$ gulp mongodump
```

Or:

```
$ gulp mongorestore
```

## Options

- Any provided options are passed to [mongodump](http://docs.mongodb.org/manual/reference/program/mongodump/) and [mongorestore](http://docs.mongodb.org/manual/reference/program/mongorestore/). The boolean value `true` should be used for options that don't accept a passed value, per the docs linked in the previous sentence.