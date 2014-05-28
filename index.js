var jaws = require('jaws');
var fc = require('./FileCache');
var util = require('util');
var tileCache = require('./TileCache');
var app = jaws();
var port = process.env.PORT || 5000;
var logger = require('bunyan');
var log = logger.createLogger({
	name:'NodeTileCache',
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


var tiles = {
	"capabaseargenmap": {},
	"osm": {
		source: [
			'http://a.tile.openstreetmaps.org',
			'http://b.tile.openstreetmaps.org',
			'http://c.tile.openstreetmaps.org'
		],
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
			r.y = ymax - r.y - 1;
			r.capa = '';
			return util.format("/%s/%s/%s.%s", r.z, r.x, r.y, r.format);
		}
	}
};

var grandTileCache = new tileCache({tileTypes:tiles});

var argenmapTileCache = new tileCache({
	transform: function(tileParams) {
		var r = {};
		for (var x in tileParams) {
			r[x] = tileParams[x]
		};
		r.capa += '@EPSG:3857@png8';
		r.format = 'png8';
		return r;
	}
});
var osmTileCache = new tileCache({
	source: ['http://a.tile.openstreetmaps.org','http://b.tile.openstreetmaps.org','http://c.tile.openstreetmaps.org'],
	transform: function(tileParams) {
		var r = {};
		for (var x in tileParams) { //extend barato para no modificar el param original
			r[x] = tileParams[x]
		};
		
		// Invert tile y origin from top to bottom of map
		var ymax = 1 << r.z;
		r.y = ymax - r.y - 1;
		r.capa = '';
		// console.log(r);
		return r;
	},
	timeout: 10000
});

// Event Handlers
argenmapTileCache.on('cache_hit',function(data){
	// log.info(data.tile,'CACHE HIT');
	console.log('HIT:');
	console.log(data.tile);
});
argenmapTileCache.on('cache_miss',function(data){
	// log.info(data.tile,'CACHE MISS');
	console.log('MISS:');
	console.log(data.tile);
});
osmTileCache.on('cache_hit',function(data){
	// log.info(data.tile,'CACHE HIT');
	console.log('HIT:');
	console.log(data.tile);
});
osmTileCache.on('cache_miss',function(data){
	// log.info(data.tile,'CACHE MISS');
	console.log('MISS:');
	console.log(data.tile);
});

argenmapTileCache.on('error',function(err){
	// log.error(err);
	console.log('ERROR: ');
	console.log(err);
});
osmTileCache.on('error',function(err){
	// log.error(err);
	console.log('ERROR: ');
	console.log(err);
});

// Request Handlers
getTile = function(req,res) {
	var time = process.hrtime();
	var tile;
	console.log(req.url);
	switch(req.route.params.capa) {
		case 'osm':
			tile = osmTileCache.getTile(req.route.params);
		break;
		default:
			tile = argenmapTileCache.getTile(req.route.params);
		break;
	}
	grandTileCache.getTile(req.route.params,req.route.params.capa);
	tile.on('error',function(err){
		//aca tendria que ir un switch para disintos errores
		// deberia responder una imagen vacia o algo que indique el error
		// res.error(err,408);
		// res.end('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAA1JREFUeNoBAgD9/wAAAAIAAVMrnDAAAAAASUVORK5CYII=');
		// res.end('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAA1JREFUeNoBAgD9/wAAAAIAAVMrnDAAAAAASUVORK5CYII=');
		res.end();
	});

	// tile.on('pipe',function(){
	// 	console.log('pipe event');
	// });
	// tile.on('end',function(){
	// 	console.log('end event');
	// });
	var head = {
		'Content-Type': 'image/png'
	}
	//la primera vez que devuelva un tile no puedo sacar el Etag
	//ya que no tengo el file y por ende el mtime
	if(tile.stats.cached) {
		head.Etag = tile.stats.Etag;
	}
	res.writeHead(200,head);
	tile.pipe(res);
}

queryTile = function(req, res) {
	switch(req.route.params.capa) {
		case 'osm':
			res.json(osmTileCache.queryTile(req.route.params));
		break;
		default:
			res.json(argenmapTileCache.queryTile(req.route.params));
		break;
	}
}
cacheStats = function(req, res) {
	var cache = new fc();
	console.log(JSON.stringify(cache.getStats()));
	res.json(cache.getStats());
}

app.route('/tms/:capa/:z/:x/:y.:format', getTile).nocache();
// app.route('/tms/osm/:z/:y/:x.:format', getTileDeOsm).nocache();
app.route('/tms/:capa/:z/:x/:y.:format/status.json', queryTile).nocache();
app.route('/cache/status.json', cacheStats).nocache();

app.httpServer.listen(port, function () {
	log.info('NodeTileCache started at port '+port);
	setInterval(function () {
	  log.info('Flushing data...');
	  app.flush();
	},1000 * 60 * 60);
});

