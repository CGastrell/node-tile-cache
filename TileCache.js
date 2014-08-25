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
  this.type = "capabaseargenmap";
  this.provider = {
    domain: 'ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
    urlTemplate: 'http://{s}.ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
    subdomains: ['mapa']
  }

  this.ttl = 1024;
  this.timeout = 5000;
  this.stats = {};
};
util.inherits(Tile, require('stream'));

Tile.prototype.write = function () {
  args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['data'].concat(args));
};
Tile.prototype.end = function () {
  args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['end'].concat(args));
};
Tile.prototype.getTileUrl = function() {
  var r = {};
  r.capa = this.capa + '@EPSG:3857@png8';
  r.z = this.z;
  r.x = this.x;
  r.y = this.y;
  r.format = 'png8';
  // return util.format("/%s/%s/%s/%s.%s", r.capa, r.z, r.x, r.y, r.format);
  return util.format("%s/%s/%s/%s/%s.%s", this.provider.urlTemplate, r.capa, r.z, r.x, r.y, r.format);
};

function TileCache(options) {
  var self = this;
  this.urlRotate = 0;
  self.options = {
    tileTypes: {},
    dir: "./cache",
    ttl: 1024
  }

  //extend defaults with options
  for (var x in options) {
    self.options[x] = options[x]
  }

  if(!Object.keys(self.options.tileTypes).length) {
    throw new Error("tileTypes is empty");
  }else{
    //agrego un rotator para las url de source
    for(var i in self.options.tileTypes) {
      self.options.tileTypes[i].rotator = 0;
    }
  }
};

util.inherits(TileCache, events.EventEmitter);
TileCache.prototype.tileStats = function(tile) {
  var tileUriPath = tile.getTileUrl();
  // var sourceUrl = this.getNextSource(tile);
  var file = this._name(tileUriPath);
  // var file = this._name(sourceUrl + tileUriPath);
  var inCache = fs.existsSync(file);
  var stats = inCache ? fs.statSync(file) : {};
  var r = {
    //request es el request original que llego al server, no se si va aca
    request: util.format("%s/%s/%s/%s.%s", tile.capa, tile.z, tile.x, tile.y, tile.format),
    cached: inCache,
    url: tileUriPath,
    // url: sourceUrl + tileUriPath,
    // uri: tileUriPath,
    templateUrl: tileUriPath,
    filePath: file,
    fileSize: inCache ? stats.size : 0,
    Etag: inCache ? this._hash(file + stats.mtime) : ''
  };
  return r;
}
TileCache.prototype.getUrl = function(tile) {
  this.options.tileTypes[tile.type].rotator = ++this.options.tileTypes[tile.type].rotator % tile.provider.subdomains.length;
  return tile.getTileUrl().replace("{s}", tile.provider.subdomains[this.options.tileTypes[tile.type].rotator]);
}

// TileCache.prototype.getNextSource = function(tile) {
//   this.options.tileTypes[tile.type].rotator = ++this.options.tileTypes[tile.type].rotator % tile.source.length;
//   return tile.source[this.options.tileTypes[tile.type].rotator];
// };

TileCache.prototype._hash = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

TileCache.prototype._name = function(key) {
  return this.options.dir + "/" + this._hash(key);
};

TileCache.prototype.getTile = function(req) {
  //aca tiene que llegar el req, y de aca separamos
  var params = req.route.params;
  var tileType = req.route.params.capa;
  var _this = this;
  var rstream;
  var tile = new Tile(params);
  tile.requestData = req.requestData;
  tile.hrtimers = req.hrtimers;

  if(this.options.tileTypes[tileType] && tileType) {
    //"extiendo" el tile segun el tipo (osm, argenmap, etc)
    var tt = this.options.tileTypes[tileType];
    for(var o in tt) {
        tile[o] = tt[o];
    }
    tile.stats = this.tileStats(tile);
  }else{
    //sino tengo el tipo de tile devuelvo el default
    var err = new Error("no tileType detected");
    err.tile = tile;
    this.emit("error", err);
    fs.createReadStream(this.options.defaultTile)
      .on('end', function(){
        tile.hrtimers.read = process.hrtime(tile.hrtimers.start);
    }).pipe(tile);
    return tile;
  }

  //chequeo si esta cacheado
  if(tile.stats.cached && tile.stats.fileSize > 0) {

    this.emit("cache_hit", { type: 'CACHE_HIT', tile: tile });

    rstream = fs.createReadStream(tile.stats.filePath)
      .on('error', function(err) {
        var e = new Error('Read file error');
        e.originalError = err;
        tile.emit('error', e, tile);
        _this.emit('error', e, tile);
    }).on('end', function(){
        tile.hrtimers.read = process.hrtime(tile.hrtimers.start);
    }).pipe(tile);
  }else{
    if(tile.stats.cached) {
      fs.unlinkSync(tile.stats.filePath);
    }
    this.emit("cache_miss", {type:'CACHE_MISS', tile: tile });

    var wstream = fs.createWriteStream(tile.stats.filePath)
      .on('error', function(err) {
        _this.emit('error',err, tile);
    });

    // var options = {
    //   host: "172.20.203.111",
    //   port: 3128,
    //   path: this.getUrl(tile)
    // }
    // var req2 = http.get(options, function(res){
    var req2 = http.get(this.getUrl(tile), function(res){
      tile.stats.fileSize = res.headers['content-length'];
      tile.hrtimers.read = process.hrtime(tile.hrtimers.start);
      res.pipe(tile);
      res.pipe(wstream);
    }).on('error', function(err) {
      var e = new Error('Tile Request Error');
      e.originalError = err;
      e.tile = tile;
      tile.hrtimers.read = process.hrtime(tile.hrtimers.start);
      tile.emit('error', e);
      _this.emit('error', e);
    }).on('socket', function(socket) {
      socket.setTimeout(tile.timeout);
      socket.on('timeout',function(){
        //el req.abort va a disparar el error de aca arriba
        req2.abort();
      });
    });

  }
  return tile;
};


module.exports = function (opts) {return new TileCache(opts || {})};