var jaws = require('jaws');
// var fc = require('./FileCache');
var util = require('util');
var tileCache = require('./TileCache');
var logger = require('bunyan');
var http = require('http');
var app = jaws();
var port = process.env.PORT || 5000;
var connectedObserver = [];
var Leftronic = require('leftronic').createClient('3M33P93THfIIN6V4dIhO');

var stats = {
  requests: 0,
  tiles: 0,
  hits: 0,
  miss: 0,
  transfer: 0,
  errors: 0
}

function tileSerializer(tile) {
  if (!tile)
        return tile;
  return {
    x: tile.x,
    y: tile.y,
    z: tile.z,
    capa: tile.capa,
    cached: tile.stats.cached,
    url: tile.stats.url,
    read: tile.hrtimers.read[0] * 1e9 + tile.hrtimers.read[1],
    serve: tile.hrtimers.delivered[0] * 1e9 + tile.hrtimers.delivered[1]
  }
};
function reqSerializer(req) {
    if (!req || !req.connection)
        return req;
    return {
        url: req.url,
        host: req.headers['host'],
        remoteAddress: req.connection.remoteAddress
    };
    // Trailers: Skipping for speed. If you need trailers in your app, then
    // make a custom serializer.
    //if (Object.keys(trailers).length > 0) {
    //  obj.trailers = req.trailers;
    //}
};
var log = logger.createLogger({
  name:'NodeTileCache',
  serializers: {
    req: reqSerializer,
    tile: tileSerializer,
    err: logger.stdSerializers.err
  },
  streams: [
    {
      type: 'rotating-file',
      level: 'info',
      period: '1d',
      path: 'logs/info.log'
    },
    {
      type: 'rotating-file',
      level: 'error',
      period: '1d',
      path: 'logs/error.log'
    }
  ]
});
log.on('error', function (err, stream) {
    console.log(err);
    console.log(stream);
});

function nanoToSeconds(hrtime) {
  return (hrtime[0] * 1e9 + hrtime[1]) / 1e9;
}

var liveConnector = null;

var tiles = {
  "capabaseargenmap": {
    provider: {
      domain: 'ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
      urlTemplate: 'http://{s}.ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
      subdomains: ['wms']
    }
  },
  "capabasesigign": {
    provider: {
      domain: 'ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
      urlTemplate: 'http://{s}.ign.gob.ar/geoserver/gwc/service/tms/1.0.0',
      subdomains: ['wms']
    }
  },
  "osm": {
    provider: {
      domain: 'tile.openstreetmaps.org',
      urlTemplate: 'http://{s}.tile.openstreetmaps.org',
      subdomains: 'a,b,c'.split(',')
    },
    timeout: 10000,
    getTileUrl: function() {
      var r = {};
      r.capa = this.capa;
      r.z = this.z;
      r.x = this.x;
      r.y = this.y;
      r.format = this.format;
      
      // Invert tile y origin from top to bottom of map
      var ymax = 1 << r.z;
      r.y = ymax - parseInt(r.y,10) - 1;
      r.capa = '';
      return util.format("%s/%s/%s/%s.%s", this.provider.urlTemplate, r.z, r.x, r.y, r.format);
    }
  }
};

var grandTileCache = new tileCache({tileTypes:tiles,defaultTile:'256.png'});


// Event Handlers
grandTileCache.on('cache_hit',function(data){
  // log.info(data.tile,'CACHE HIT');
  console.log('CACHE HIT: ' + data.tile.stats.url);
  stats.hits++;
  stats.transfer += data.tile.stats.fileSize;
  // var lap = process.hrtime(data.tile.hrtimers.start);
  // console.log(lap[0] + 1 / 1000000000 * lap[1]);
  // if(liveConnector) {
  //   liveConnector.emit(data.type,{url:data.tile.stats.url});
  // }
}).on('cache_miss',function(data){
  // log.info(data.tile,'CACHE MISS');
  console.log('CACHE MISS: ' + data.tile.stats.url);
  stats.miss++;
  // var lap = process.hrtime(data.tile.hrtimers.start);
  // console.log(lap[0] + 1 / 1000000000 * lap[1]);
  // if(liveConnector) {
  //   liveConnector.emit(data.type,{url:data.tile.stats.url});
  // }
}).on('tile_served',function(data){
  console.log('TILE SERVED: ' + data.tile.stats.filePath);
  stats.tiles++;
  console.log(data.tile.stats.fileSize);
  // log.info({req:data.tile.requestData, tile:data.tile},'TILE SERVED');
  sendToClients(data.type,{
    tileTimes:data.tile.hrtimers,
    tileRequest:data.tile.requestData,
    tileStats: data.tile.stats});
  //3M33P93THfIIN6V4dIhO
  Leftronic.pushNumber({
    streamName: 'avgDeliverTime',
    number: nanoToSeconds(data.tile.hrtimers.delivered),
    suffix: 's'
    }, function(err, result) {
    if (err) console.log(err);
    //console.log(result);
  });
  Leftronic.pushNumber({
    streamName: 'avgTileSize',
    number: data.tile.stats.fileSize / 1024,
    suffix: 'Kb'
    }, function(err, result) {
    if (err) console.log(err);
  });

}).on('error',function(err){
  // log.error(err);
  console.log('ERROR: ');
  console.log(err);
  stats.errors++;
  // var lap = process.hrtime(tile.hrtimers.start);
  // console.log('IN: ' + nanoToSeconds(lap));
});


// Request Handlers
getTile = function(req,res) {
  console.log('REQUEST: ' + req.url);
  stats.requests++;
  req.hrtimers = {
    start: process.hrtime(), //cuando recibo el request, ns desde que esta corriendo el process
    read: null, //cuando termino de recibir el tile (hit -> disk io, miss -> response)
    delivered: null //cuando termino de enviar al cliente
  };
  // console.log(req.headers);
  req.requestData = {
   host: req.headers["host"],
   client: req.connection.remoteAddress,
   referer: req.headers["referer"] || req.headers["host"],
   "x-forwarded-for": req.headers["x-forwarded-for"] || "direct"
  };
  // console.log(req.requestData);
  var tile = grandTileCache.getTile(req);

  tile.on('error',function(err){
    console.log('TILE ERROR:');
    console.log(err);
    stats.errors++;
    //aca tendria que ir un switch para disintos errores
    // deberia responder una imagen vacia o algo que indique el error
    // res.error(err,408);
    // res.end('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAA1JREFUeNoBAgD9/wAAAAIAAVMrnDAAAAAASUVORK5CYII=');
    // res.end('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAA1JREFUeNoBAgD9/wAAAAIAAVMrnDAAAAAASUVORK5CYII=');
    res.end();
    return;
  });

  var head = {
    'Content-Type': 'image/png',
    'Cache-Control': 'public,max-age=7776000'//90 dias
  }
  //la primera vez que devuelva un tile no puedo sacar el Etag
  //ya que no tengo el file y por ende el mtime
  if(tile.stats.cached) {
    head.Etag = tile.stats.Etag;
    // res.writeHead(304,head);
  }
  res.writeHead(200,head);
  res.on('finish',function(){
    tile.hrtimers.delivered = process.hrtime(tile.hrtimers.start);
    console.log('SERVED IN: '+nanoToSeconds(tile.hrtimers.delivered));
    grandTileCache.emit('tile_served',{type:'tile_served',tile:tile});
  });
  tile.pipe(res);
}

// queryTile = function(req, res) {
//  res.json(grandTileCache.queryTile(req.route.params));
// }
// cacheStats = function(req, res) {
//  var cache = new fc();
//  console.log(JSON.stringify(cache.getStats()));
//  res.json(cache.getStats());
// }


app.route('/tms/1.0.0/:capa/:z/:x/:y.:format', getTile).nocache();
app.route('/tms/:capa/:z/:x/:y.:format', getTile).nocache();
// app.route('/tms/osm/:z/:y/:x.:format', getTileDeOsm).nocache();

// app.route('/tms/:capa/:z/:x/:y.:format/status.json', queryTile).nocache();
// app.route('/cache/status.json', cacheStats).nocache();

app.route('/givemestats').nocache().file('wazzap.html');

app.httpServer.listen(port, function () {
  console.log('NodeTileCache started at port '+port);
  setInterval(function () {
    console.log('Flushing data...');
    app.flush();
  },1000 * 60 * 60);
});

function sendToClients(type,msg) {
  if(!liveConnector) {
    return false;
  }
  liveConnector.emit(type,msg);
}
//socket stuff
//copiando de:
//http://coenraets.org/blog/2012/10/real-time-web-analytics-with-node-js-and-socket-io/
var io = require('socket.io').listen(app.httpServer);
io.sockets.on('error', function(){
  console.log('Sockets',arguments);
});
io.sockets.on('connection', function (socket) {

  console.log('client connected');
  connectedObserver.push(socket);

  socket.on('disconnect', function(){
    console.log('client disconnected');
    var i = connectedObserver.indexOf(socket);
    if(i > -1) {
      delete connectedObserver[i];
      connectedObserver.splice(i,1);
    }
    liveConnector = null;
  });

  socket.on('error', function(){
    console.log('Socket',arguments);
  });

  socket.on('message', function (message) {
      console.log("Got message from: ", message.origin);
      io.sockets.emit('pageview', { 'url': message });
  });

  liveConnector = io.sockets;
});
