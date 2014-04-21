var jaws = require("jaws");
var fc = require("./FileCache");
var tmsProxy = require("./TMSProxy");
var tc = require("./TileCache");
var app = jaws();
var port = process.env.PORT || 5000;

// var tmsProxy = new tms();

getTile2 = function(req,res) {
	var tileCache = new tc();
	// tileCache.on('cache_hit',function(data){
	// 	console.log(data);
	// });
	// tileCache.on('cache_miss',function(data){
	// 	console.log(data);
	// });

	tileCache.once('tile_ready', function(rStream){
		console.log('tile ready');
		rStream.pipe(res);
	});
	tileCache.get(tileCache.queryTile(req.route.params).url);
}
getTile = function(req, res) {
	// console.log(this);
	tmsProxy.getTile(req, res);
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
app.route("/cache/status", cacheStats).nocache();

app.httpServer.listen(port, function () {
	console.log("Running now.")
	setInterval(function () {
	  console.log('Flushing data...');
	  app.flush();
	},1000 * 60 * 60);
});

