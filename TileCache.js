var events = require('events');
var util = require('util');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');


function Tile(params) {
  this.readable = true;
  this.writable = true;

  this.source = ['http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0'];
  this.capa = params.capa;
  this.x = params.x;
  this.y = params.y;
  this.z = params.z;
  this.format = params.format;
  this.type = "capabaseargenmap";

  this.timeout = 5000;
  this.stats = {};
  this.data = {};
}
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
  r.capa = '@EPSG:3857@png8' + this.capa;
  r.z = this.z;
  r.x = this.x;
  r.y = this.y;
  r.format = 'png8';
  return util.format("/%s/%s/%s/%s.%s", r.capa, r.z, r.x, r.y, r.format);
};

function TileCache(options) {
  var self = this;
  this.urlRotate = 0;
  self.options = {
    tileTypes: {},
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

  if(!Object.keys(self.options.tileTypes).length) {
    console.log("tileTypes is empty");
    // throw new Error("tileTypes is empty");
  }else{
    //agrego un rotator para las url de source
    for(var i in self.options.tileTypes) {
      self.options.tileTypes[i].rotator = 0;
    }
  }
}

util.inherits(TileCache, events.EventEmitter);
TileCache.prototype.tileStats = function(tile) {
  var params = tile;
  var url = this.buildUrl(tile);
  var file = this._name(url);
  var inCache = fs.existsSync(file);
  var stats = inCache ? fs.statSync(file) : {};
  var r = {
    request: util.format("%s/%s/%s/%s.%s", params.capa, params.z, params.x, params.y, params.format),
    cached: inCache,
    sourceUrl: url,
    uri: this.buildUri(tile),
    filePath: file,
    fileSize: inCache ? stats.size : 0,
    Etag: inCache ? this._hash(file + stats.mtime) : ''
  };
  return r;
}
TileCache.prototype.buildUri = function(params) {
  // var vars = this.options.transform(params);
  var vars = params;
  var tileURi = util.format("%s/%s/%s/%s.%s", vars.capa, vars.z, vars.x, vars.y, vars.format);
  return tileURi;
};
TileCache.prototype.getNextSource = function(tileType) {
  this.options.tileTypes[tileType].rotator = ++this.options.tileTypes[tileType].rotator % this.options.tileTypes[tileType].source.length;
  return this.options.tileTypes[tileType].source[this.options.tileTypes[tileType].rotator];
}
TileCache.prototype.buildUrl = function(params) {
  this.urlRotate = ++this.urlRotate % this.options.source.length;
  var tileURL = this.options.source[this.urlRotate] + "/" + this.buildUri(params);
  return tileURL;
};

TileCache.prototype._hash = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

TileCache.prototype._name = function(key) {
  return this.options.dir + "/" + this._hash(key);
};

TileCache.prototype.getTile = function(params, tileType) {
  var tile2 = new Tile(params);
  if(this.options.tileTypes[tileType]) {
    var tt = this.options.tileTypes[tileType];
    for(var o in tt) {
        tile2[o] = tt[o];
    }
    console.log(this.getNextSource(tileType));
    console.log(tile2.getTileUrl());
    return;
  }

  var tile = new Tile(this.options.transform(params));
  tile.stats = this.tileStats(tile);
  var _this = this;
  var expiration = this.options.ttl;

  if(tile.stats.cached && tile.stats.fileSize > 0) {
    this.emit("cache_hit", { type: 'CACHE_HIT', tile: tile.stats });
    var rstream = fs.createReadStream(tile.stats.filePath);
    rstream.on('error', function(err) {
      var e = new Error('Read file error');
      e.originalError = err;
      tile.emit('error',e);
      _this.emit('error',e);
    });
    rstream.pipe(tile);
  }else{
    if(tile.stats.cached) {
      fs.unlinkSync(tile.stats.filePath);
    }
    this.emit("cache_miss", {type:'CACHE_MISS', tile: tile.stats });

    var wstream = fs.createWriteStream(tile.stats.filePath);
    wstream.on('error', function(err) {
      _this.emit('error',err);
    });

    var options = {
      host: "172.20.203.111",
      port: 3128,
      path: tile.stats.sourceUrl
    }
    var req = http.get(options, function(res){
      res.pipe(tile);
      res.pipe(wstream);
    }).on('error', function(err) {
      var e = new Error('WMS Request Error');
      e.originalError = err;
      tile.emit('error',e);
      _this.emit('error',e);
    }).on('socket', function(socket) {
      socket.setTimeout(_this.options.timeout);
      socket.on('timeout',function(){
        //el req.abort va a disparar el error de aca arriba
        req.abort();
      });
    });

  }
  return tile;
};


module.exports = function (opts) {return new TileCache(opts || {})};