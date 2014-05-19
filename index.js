var jaws = require("jaws");
var fc = require("./FileCache");
var tmsProxy = require("./TMSProxy");
var tileCache = require("./TileCache");
var app = jaws();
var port = process.env.PORT || 5000;


var argenmapTileCache = new tileCache({
	transform: function(tileParams) {
		var r = {};
		for (var x in tileParams) {
			r[x] = tileParams[x]
		};
		r.capa += '@EPSG:3857@png8';
		r.format = "png8";
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
		return r;
	},
	timeout: 10000
})

// Event Handlers
argenmapTileCache.on('cache_hit',function(data){
	console.log('HIT:');
	console.log(data);
});
argenmapTileCache.on('cache_miss',function(data){
	console.log('MISS:');
	console.log(data);
});
argenmapTileCache.on('error',function(err){
	console.log('ERROR: ');
	console.log(err);
});
osmTileCache.on('error',function(err){
	console.log('ERROR: ');
	console.log(err);
});

// Request Handlers
getTile = function(req,res) {
	var time = process.hrtime();
	var tile;
	switch(req.route.params.capa) {
		case "osm":
			tile = osmTileCache.getTile(req.route.params);
		break;
		default:
			tile = argenmapTileCache.getTile(req.route.params);
		break;
	}
	tile.on('error',function(err){
		//aca tendria que ir un switch para disintos errores
		// res.error(err,408);
		res.end();
	});
	tile.on('pipe',function(){
		console.log('pipe event');
	});
	tile.on('end',function(){
		console.log('end event');
		// res.addTrailers({
		// 	'Content-Type': 'image/png',
		// 	'ETag':'hola'
		// });
		// res.end();
	});
		res.writeHead(200,{
			'Content-Type': 'image/png',
			'ETag':'hola'
		});
		tile.pipe(res);
		// console.log(res);
}

queryTile = function(req, res) {
	switch(req.route.params.capa) {
		case "osm":
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

app.route("/tms/:capa/:z/:x/:y.:format", getTile).nocache();
// app.route("/tms/osm/:z/:y/:x.:format", getTileDeOsm).nocache();
app.route("/tms/:capa/:z/:x/:y.:format/status.json", queryTile).nocache();
app.route("/cache/status.json", cacheStats).nocache();

app.httpServer.listen(port, function () {
	console.log("Running now.")
	setInterval(function () {
	  console.log('Flushing data...');
	  app.flush();
	},1000 * 60 * 60);
});

