var events = require('events');
var util = require('util');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');

/**
* Creates an object representation for a map tile
*
* @class
* @constructor Tile
* @extends stream
* @see {@link http://nodejs.org/api/stream.html}
* @param {Object} params hash with tile properties
* @param {string} params.type the type of tiles defined upon instanciation
* @param {int} params.x x value for the tile
* @param {int} params.y y value for the tile
* @param {int} params.z z value for the tile
* @param {string} params.capa layer/style of the tile to retrieve
* @param {string} params.format format/extension of image type for the tiles
* @param {Object} params.provider hash of properties for the tile provider
* @param {string} params.provider.domain url (without protocol) for the root service to get the tile from
* @param {string} params.provider.urlTemplate printf formatted string. {s} will be replaced with subdomains values
* @param {Array} params.provider.subdomains available values to use in urlTemplate {s}
*/
var Tile = function(params) {
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
/* @private */
Tile.prototype.write = function () {
  args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['data'].concat(args));
};
/* @private */
Tile.prototype.end = function () {
  args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['end'].concat(args));
};

/**
* Builds url to tile image. This method should be overwritten when configuring new tile sources.
*
*
* @returns {string} URL of the Tile
*/
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

/**
* @class TileCache
* @classdesc Instanciates a TileCache object. TileCache will have it's own storage directory
* and default Tile's it can retrieve.
*
* Upon construction, TileCache needs basically 2 things:
*
* - where to put the cached files (defaults to ./cache)
* - what types of tiles it's going to retreive (required)
*
* The tileTypes option is an object with directives for every type of tile you want to serve from this cache
*
* tileTypes are defined with an object with type, provider and getTileUrl properties described
* in {@link Tile} class constructor
*
* @example
* //Usage with a tileType for OSM
* var tt = {
*    "osm": {
*        provider: {
*            domain: 'tile.openstreetmaps.org',
*            urlTemplate: 'http://{s}.tile.openstreetmaps.org',
*            subdomains: 'a,b,c'.split(',')
*        },
*        timeout: 10000, //defaults to 5000, in ms
*        getTileUrl: function() {
*            // this overrides the default url construction, which responds to TMS 1.0.0 standards
*            var r = {};
*            r.capa = this.capa;
*            r.z = this.z;
*            r.x = this.x;
*            r.y = this.y;
*            r.format = this.format;
*            
*            // Invert tile y origin from top to bottom of map, thus converting from
*            // standard TMS 1.0.0 service to Google/OSM/Mapnik
*            var ymax = 1 << r.z;
*            r.y = ymax - r.y - 1;
*            r.capa = '';
*            return util.format("%s/%s/%s/%s.%s", this.provider.urlTemplate, r.z, r.x, r.y, r.format);
*        }
*    }
* });
* var tc = new TileCache({tileTypes: tt, defaultTile: '256.png'});
*
* 
* @constructor
* @param {Object} options hash with TileCache options
* @param {Object} options.tileTypes see example above
* @param {string} options.dir The path to storage cached tiles. Relative.
* @param {int} options.ttl TTL for cached tiles
* @param {String} options.defaultTile path to a default image. When something goes wrong, this image will be served
* @extends events.EventEmitter
* @fires TileCache#error
* @fires TileCache#cache_hit
* @fires TileCache#cache_miss
*/
function TileCache(options) {
  var self = this;

  /** keeps track of optional hosts use for Tile retrieval */
  this.urlRotate = 0;

  /** Default options object */
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

/**
* Returns stats object for a given {@link Tile}
* 
* @param {Tile} Tile to get stats of
* @returns {Object} Javascript object with Tile properties:
* - __request__: _{string}_ representation of the original request received by the server
* - __cached__: {boolean}_ whether the tile is in cache or not
* - __url__: _{string}_ the url where the Tile is being retreived from
* - __templateUrl__: _{string}_ same as url (deprecation notice)
* - __filePath__: _{string}_ the path to the cached version of the Tile
* - __fileSize__: _{int}_ the size in bytes of the cached Tile. Defaults to 0 if Tile is not in cache
* - __Etag__: _{string}_ the Etag generated for the Tile. The first time a Tile is retreived the Etag returns empty 
*/
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

/**
* Builds the url for provided {@link Tile} based on {@link Tile#getTileUrl}.
*
* If the tileType.provider has more than one subdomain, the instance will iterate over the subdomains
* to ease requests to a server. Elegantly, the cache makes no distinction of the subdomain, so when
* a tile is requested to one of the subdomains, it is valid for all of them.
*
* So, for what cache is concerned:
* 
* http://a.tile.openstreetmaps.org == http://b.tile.openstreetmaps.org
*
* @param {Tile} tile
* @returns {String} url The url to get the tile from
*/
TileCache.prototype.getUrl = function(tile) {
  this.options.tileTypes[tile.type].rotator = ++this.options.tileTypes[tile.type].rotator % tile.provider.subdomains.length;
  return tile.getTileUrl().replace("{s}", tile.provider.subdomains[this.options.tileTypes[tile.type].rotator]);
}

/**
* Creates a MD5 hash for a string
*
* TileCache hashes all urls to avoid conflicts in the cache.
*
* @returns {string} hashed value of the string
* @private
*/
TileCache.prototype._hash = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

/**
* Returns a path to a cached {@link Tile}
*
* @param {string} key 
* @private
*/
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
  tile.requestData = req;
  tile.debugData = req.debugData;

  if(this.options.tileTypes[tileType] && tileType) {
    //"extiendo" el tile segun el tipo (osm, argenmap, etc)
    var tt = this.options.tileTypes[tileType];
    for(var o in tt) {
        tile[o] = tt[o];
    }
    tile.stats = this.tileStats(tile);
  }else{
    //sino tengo el tipo de tile devuelvo el default
/**
* Error event.
*
* @event TileCache#error
* @type {object}
* @arg {Error} error
* @arg {Tile} tile
*/
    this.emit("error", new Error("no tileType detected"), tile);
    fs.createReadStream(this.options.defaultTile)
      .on('end', function(){
        tile.debugData.tileRead = process.hrtime(tile.debugData.tileRequested);
    }).pipe(tile);
    return tile;
  }

  //chequeo si esta cacheado
  if(tile.stats.cached && tile.stats.fileSize > 0) {
/**
* CACHE HIT event.
*
* @event TileCache#cache_hit
* @type {object}
* @property {String} type - Indicates the type of event. In this case "CACHE_HIT"
* @property {Tile} tile {@link Tile} being served from cache
*/
    this.emit("cache_hit", { type: 'CACHE_HIT', tile: tile });

    rstream = fs.createReadStream(tile.stats.filePath)
      .on('error', function(err) {
        var e = new Error('Read file error');
        e.originalError = err;
        tile.emit('error', e, tile);
        _this.emit('error', e, tile);
    }).on('end', function(){
        tile.debugData.tileRead = process.hrtime(tile.debugData.tileRequested);
    }).pipe(tile);
  }else{
    if(tile.stats.cached) {
      fs.unlinkSync(tile.stats.filePath);
    }
/**
* CACHE MISS event.
*
* @event TileCache#cache_miss
* @type {object}
* @property {String} type - Indicates the type of event. In this case "CACHE_MISS"
* @property {Tile} tile {@link Tile} being served from origin
*/
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
      tile.debugData.tileRead = process.hrtime(tile.debugData.tileRequested);
      res.pipe(tile);
      res.pipe(wstream);
    }).on('error', function(err) {
      var e = new Error('Tile Request Error');
      e.originalError = err;
      tile.debugData.tileRead = process.hrtime(tile.debugData.tileRequested);
      tile.emit('error', e, tile);
      _this.emit('error', e, tile);
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