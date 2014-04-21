var events = require('events');
var util = require('util');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');

function TileCache(options) {
  var self = this;

  self.options = {
    source: 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
    dir: "./cache",
    ttl: 1024
  };

  //extend defaults with options
  for (var x in options) {
    self.options[x] = options[x]
  }
}

util.inherits(TileCache, events.EventEmitter);

TileCache.prototype.queryTile = function(params) {
  var url = this.buildUrl(params);
  var r = {
    cached: this.isCached(url),
    url: url,
    filePath: this._name(url)
  };
  return r;
};

TileCache.prototype.buildUrl = function(params) {
  var vars = params;
  var capa = vars.capa + '@EPSG:3857@png8';
  // console.log(req);
  var tileURL = util.format("%s/%s/%s/%s/%s.%s", this.options.source, capa, vars.z, vars.y, vars.x, vars.format + "8");
  return tileURL;
};
TileCache.prototype.isCached = function(url) {
  return fs.existsSync(this._name(url));
};

TileCache.prototype._hash = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

TileCache.prototype._name = function(key) {
  return this.options.dir + "/" + this._hash(key);
};

TileCache.prototype.get = function(url) {
  //
  var cachePath = this._name(url);
  var _this = this;
  var expiration = this.options.ttl;

  var stream;
  if(fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    this.emit("cache_hit", {cache:'HIT',filePath:cachePath});
    stream = fs.createReadStream(cachePath);
    stream.on('error', function(err) {
      _this.emit('error',err);
    });

    this.emit('tile_ready',stream);

    // stream.on('data', function(chunk) {
    //   // console.log(arguments);
    //   _this.emit('data', chunk);
    // });

    // stream.on('end', function(chunk) {
    //   _this.emit('end', 'done');
    // });

  }else{
    this.emit("cache_miss", {cache:'MISS',filePath:cachePath});

    stream = fs.createWriteStream(cachePath);
    stream.on('error', function(err) {
      _this.emit('error',err);
    });

    // stream.on('data', function(chunk) {
    //   _this.emit('data', chunk);
    // });

    // stream.on('end', function(chunk) {
    //   _this.emit('end', 'done');
    // });

    http.get(url, function(res){

      res.pipe(stream,{end: false});
      res.on('end', function(){
        stream.end();
        _this.emit('tile_ready',fs.createReadStream(cachePath));
      })
      
    }).on('error', function(err) {
      _this.emit('error',err);
    });
    // }).on('end',function(){console.log('caruso')});
    // request(url,function(err, incomingMsg, body){
  }
};


module.exports = function (opts) {return new TileCache(opts || {})};