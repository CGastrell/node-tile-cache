var events = require('events');
var util = require('util');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');


function Tile(params) {
  this.readable = true;
  this.writable = true;
  this.capa = params.capa;
  this.x = params.x;
  this.y = params.y;
  this.z = params.z;
  this.format = params.format;
  this.stats = {};
}
util.inherits(Tile, require('stream'));
Tile.prototype.write = function () {
  args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['data'].concat(args))
};
Tile.prototype.end = function () {
  args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['end'].concat(args))
};

function TileCache(options) {
  var self = this;
  this.urlRotate = 0;
  self.options = {
    source: ['http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0'],
    dir: "./cache",
    ttl: 1024,
    timeout: 5000,
    transform: function(tileParams) {return tileParams;}
  };

  //extend defaults with options
  for (var x in options) {
    self.options[x] = options[x]
  };
}

util.inherits(TileCache, events.EventEmitter);
TileCache.prototype.tileStats = function(tile) {
  var params = tile;
  var url = this.buildUrl(tile);
  var file = this._name(url);
  var inCache = this.isCached(url);
  var r = {
    request: util.format("%s/%s/%s/%s.%s", params.capa, params.z, params.x, params.y, params.format),
    cached: inCache,
    sourceUrl: url,
    uri: this.buildUri(tile),
    filePath: file,
    fileStats: inCache ? fs.statSync(file) : {}
  };
  return r;
}
TileCache.prototype.queryTile = function(params) {
  
  var url = this.buildUrl(params);
  var file = this._name(url);
  var inCache = this.isCached(url);
  var r = {
    request: util.format("%s/%s/%s/%s.%s", params.capa, params.z, params.x, params.y, params.format),
    cached: inCache,
    sourceUrl: url,
    uri: this.buildUri(params),
    filePath: file,
    // etag: crypto.createHash('md5').update(str).digest('hex'),
    fileStats: inCache ? fs.statSync(file) : {}
  };
  return r;
};
TileCache.prototype.buildUri = function(params) {
  var vars = this.options.transform(params);
  var tileURi = util.format("/%s/%s/%s/%s.%s", vars.capa, vars.z, vars.x, vars.y, vars.format);
  return tileURi;
};
TileCache.prototype.buildUrl = function(params) {
  this.urlRotate = ++this.urlRotate % this.options.source.length;
  var tileURL = this.options.source[this.urlRotate] + this.buildUri(params);
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

TileCache.prototype.getTile = function(params) {
  //
  var tile = new Tile(this.options.transform(params));
  var tileInfo = this.tileStats(tile);
  var _this = this;
  var expiration = this.options.ttl;

  if(tileInfo.cached && tileInfo.fileStats.size > 0) {
    this.emit("cache_hit", { type: 'CACHE_HIT', tile: tileInfo });
    var rstream = fs.createReadStream(tileInfo.filePath);
    rstream.on('error', function(err) {
      tile.emit('error',err);
      _this.emit('error',err);
    });
    rstream.pipe(tile);

  }else{
    if(tileInfo.cached) {
      fs.unlinkSync(tileInfo.filePath);
    }
    this.emit("cache_miss", {type:'CACHE_MISS', tile: tileInfo });

    var wstream = fs.createWriteStream(tileInfo.filePath);
    wstream.on('error', function(err) {
      _this.emit('error',err);
    });

    var options = {
      host: "172.20.203.111",
      port: 3128,
      path: tileInfo.sourceUrl
    }
    var req = http.get(options, function(res){
    // var req = http.get(tileInfo.sourceUrl, function(res){
      res.pipe(wstream,{end: false});
      res.on('end', function(){
        wstream.end();
        fs.createReadStream(tileInfo.filePath).pipe(tile);
      });
    }).on('error', function(err) {
      tile.emit('error',err);
      _this.emit('error',err);
    }).on('socket', function(socket) {
      socket.setTimeout(_this.options.timeout);
      socket.on('timeout',function(){
        req.abort();
      });
    });

  }
  return tile;
};


module.exports = function (opts) {return new TileCache(opts || {})};