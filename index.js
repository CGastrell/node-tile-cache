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

var timer;

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

var grandTileCache = new tileCache({tileTypes:tiles,defaultTile:'256.png'});


// Event Handlers
grandTileCache.on('cache_hit',function(data){
	// log.info(data.tile,'CACHE HIT');
	console.log('CACHE HIT: ' + data.tile.url);
	var lap = process.hrtime(timer);
	console.log('IN: ' + process.hrtime(timer)[0] + 1 / 1000000000 * lap[1]);
});
grandTileCache.on('cache_miss',function(data){
	// log.info(data.tile,'CACHE MISS');
	console.log('CACHE MISS: ');
	console.log(data.tile.url);
	var lap = process.hrtime(timer);
	console.log('IN: ' + process.hrtime(timer)[0] + 1 / 1000000000 * lap[1]);
});


grandTileCache.on('error',function(err){
	// log.error(err);
	console.log('ERROR: ');
	console.log(err);
	var lap = process.hrtime(timer);
	console.log(process.hrtime(timer)[0] + 1 / 1000000000 * lap[1]);
});


// Request Handlers
getTile = function(req,res) {
	console.log('REQUEST: ' + req.url);
	timer = process.hrtime();
	var tile = grandTileCache.getTile(req.route.params,req.route.params.capa);

	tile.on('error',function(err){
		//aca tendria que ir un switch para disintos errores
		// deberia responder una imagen vacia o algo que indique el error
		// res.error(err,408);
		// res.end('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAA1JREFUeNoBAgD9/wAAAAIAAVMrnDAAAAAASUVORK5CYII=');
		// res.end('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAA1JREFUeNoBAgD9/wAAAAIAAVMrnDAAAAAASUVORK5CYII=');
		res.end();
	});

	var head = {
		'Content-Type': 'image/png'
	}
	//la primera vez que devuelva un tile no puedo sacar el Etag
	//ya que no tengo el file y por ende el mtime
	if(tile.stats.cached) {
		head.Etag = tile.stats.Etag;
	}
	res.writeHead(200,head);
	res.on('finish',function(){
		console.log('Done:');
		var lap = process.hrtime(timer);
		console.log(process.hrtime(timer)[0] + 1 / 1000000000 * lap[1]);
	});
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
	console.log('NodeTileCache started at port '+port);
	setInterval(function () {
	  log.info('Flushing data...');
	  app.flush();
	},1000 * 60 * 60);
});

