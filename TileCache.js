var events = require('events');
var util = require('util');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');

function Tile(params) {
  this.capa = params.capa;
  this.x = params.x;
  this.y = params.y;
  this.z = params.z;
  this.format = params.format;
  this.stat = {};
  return this;
}
function TileCache(options) {
  var self = this;

  self.options = {
    source: 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
    dir: "./cache",
    ttl: 1024,
    timeout: 5000
  };

  //extend defaults with options
  for (var x in options) {
    self.options[x] = options[x]
  };
}

util.inherits(TileCache, events.EventEmitter);

TileCache.prototype.queryTile = function() {
  var params = this.options.tileParams;
  var url = this.buildUrl();
  var file = this._name(url);
  var inCache = this.isCached(url);
  var r = {
    request: util.format("%s/%s/%s/%s.%s", params.capa, params.z, params.y, params.x, "png"),
    cached: inCache,
    sourceUrl: url,
    uri: this.buildUri(),
    filePath: file,
    fileStats: inCache ? fs.statSync(file) : {}
  };
  return r;
};
TileCache.prototype.buildUri = function() {
  var vars = this.options.tileParams;
  var capa = vars.capa + '@EPSG:3857@png8';
  var tileURi = util.format("/%s/%s/%s/%s.%s", capa, vars.z, vars.y, vars.x, "png8");
  return tileURi;
};
TileCache.prototype.buildUrl = function() {
  var tileURL = this.options.source + this.buildUri();
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

TileCache.prototype.getTile = function() {
  //
  var tileInfo = this.queryTile();
  var _this = this;
  var expiration = this.options.ttl;

  var stream;
  if(tileInfo.cached && tileInfo.fileStats.size > 0) {
    this.emit("cache_hit", { type: 'CACHE_HIT', tile: tileInfo });
    stream = fs.createReadStream(tileInfo.filePath);
    stream.on('error', function(err) {
      _this.emit('error',err);
    });
    this.emit('tile_ready', stream, tileInfo.fileStats.size);
  }else{
    if(tileInfo.cached) {
      fs.unlinkSync(tileInfo.filePath);
    }
    this.emit("cache_miss", {type:'CACHE_MISS', tile: tileInfo });

    stream = fs.createWriteStream(tileInfo.filePath);
    stream.on('error', function(err) {
      _this.emit('error',err);
    });

    var options = {
      host: "172.20.203.111",
      port: 3128,
      path: tileInfo.sourceUrl
    }

    var req = http.get(options, function(res){

      res.pipe(stream,{end: false});
      res.on('end', function(){
        stream.end();
        _this.emit('tile_ready',fs.createReadStream(tileInfo.filePath), tileInfo.fileStats.size);
      })
      
    }).on('error', function(err) {
      _this.emit('error',err);
    }).on('socket', function(socket) {
      socket.setTimeout(_this.options.timeout);
      socket.on('timeout',function(){
        req.abort();
      });
    });
    // }).on('end',function(){console.log('caruso')});
    // request(url,function(err, incomingMsg, body){
  }
};


module.exports = function (opts) {return new TileCache(opts || {})};