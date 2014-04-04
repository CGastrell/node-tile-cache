(function() {
  var EventEmitter, FileCache,
  // __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  // __slice = [].slice;
  __hasProp = {}.hasOwnProperty,
  __extendClass = function(child, parent) {
    for (var key in parent) {
      if (__hasProp.call(parent, key)) child[key] = parent[key];
    }
    function ctor() {
      this.constructor = child;
    }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.__super__ = parent.prototype;
    return child;
  },
  http = require('http'),
  fs = require('fs'),
  crypto = require('crypto'),
  extendObject = function (a, b) { for (var x in a) b[x] = a[x] },
  EventEmitter = require('events').EventEmitter;

  module.exports = FileCache = (function(_super) {
    __extendClass(FileCache, _super);

    function FileCache(options) {
      this.options = options != null ? options : {};
      extendObject({
        dir: "./cache",
        ttl: 1024
      },this.options);
    }

    FileCache.prototype._hash = function(str) {
      return crypto.createHash('md5').update(str).digest('hex');
    };

    FileCache.prototype._name = function(key) {
      return this.options.dir + "/" + this._hash(key);
    };

    FileCache.prototype.getFromRequest = function(req) {
      //
    };

    FileCache.prototype.getStats = function() {
      // var fileStats = fs.statSync(this.options.dir);

      var fileStats = fs.readdirSync(this.options.dir);
      
      // if(new Date() - fileStats.ctime.getTime() > expiration) {
      //   //expicho, hay que buscarlo de nuevo
      // }
      return fileStats;
    };

    FileCache.prototype.get = function(url) {
      //
      var cachePath = this._name(url);
      var _this = this;
      var expiration = this.options.ttl;
      var writeMode = false;

      var stream;
      if(fs.existsSync(cachePath)) {
        this.emit("cache_hit", 'File is cached at '+cachePath);
        stream = fs.createReadStream(cachePath);

        stream.on('data', function(chunk){
          // console.log(arguments);
          _this.emit('data', chunk);
        });

        stream.on('end', function(chunk) {
          _this.emit('end', chunk);

        });
      }else{
        this.emit("cache_miss", url);
        writeMode = true;

        var tile = fs.createWriteStream(cachePath)
        http.get(url, function(res){

          stream = res;
          stream.on('data', function(chunk){
            _this.emit('data', chunk);
            tile.write(chunk);
          });

          stream.on('end', function() {
            _this.emit('end');
          });
        });
        // }).on('end',function(){console.log('caruso')});
        // request(url,function(err, incomingMsg, body){
      }


    };

    return FileCache;

  })(EventEmitter);

}).call(this);