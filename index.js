var jaws = require("jaws");
var fc = require("./FileCache");
var tmsProxy = require("./TMSProxy");
var tc = require("./TileCache");
var app = jaws();
var port = process.env.PORT || 5000;

var tileCache = new tc();

tileCache.on('cache_hit',function(data){
	console.log('HIT:');
	console.log(data);
});
tileCache.on('cache_miss',function(data){
	console.log('MISS:');
	console.log(data);
});
tileCache.on('error',function(err){
	console.log(err);
})

getTile2 = function(req,res) {
	var time = process.hrtime();

	var tile = tileCache.getTile(req.route.params);
	tile.on('error',function(err){
		//aca tendria que ir un switch para disintos errores
		res.error(err,408);
	});
	tile.pipe(res);
	tile.on('readable', function(){
		
		res.writeHead(200,{
			'Content-Type': 'image/png',
			'ETag':'hola'
		});
	});
	// tileCache.once('tile_ready', function(stream, size){
	// 	console.log('tile ready');
	// 	// console.log(arguments);
	// 	stream.pipe(res).on('end',function(){
	// 		res.end();
	// 	});
	// 	// res.end();
	// 	return;
	// });
	// // console.log(req.route);
	// tileCache.getTile(req.route.params);
	// return;
}
getTile = function(req, res) {
	tmsProxy.getTile(req, res);
}
queryTile = function(req, res) {
	res.json(tileCache.queryTile(req.route.params));
}
cacheStats = function(req, res) {
	var cache = new fc();
	console.log(JSON.stringify(cache.getStats()));
	res.json(cache.getStats());
}

//si en este route uso tmsProxy.getTile, la funcion se ejecuta con context de app
//tengo que declarar getTile arriba a modo de wrapper y llamarla desde ahi... (?)
// app.route("/tms/:capa/:z/:y/:x.:format", getTile).nocache();
app.route("/tms/:capa/:z/:y/:x.:format", getTile2).nocache();
app.route("/tms/:capa/:z/:y/:x.:format/status.json", queryTile).nocache();
app.route("/cache/status", cacheStats).nocache();

app.httpServer.listen(port, function () {
	console.log("Running now.")
	setInterval(function () {
	  console.log('Flushing data...');
	  app.flush();
	},1000 * 60 * 60);
});

