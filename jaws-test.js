var jaws = require("jaws");
var utils = require("util");
var fc = require("./FileCache");
var app = jaws();


TMSProxy = function (req, res) {
	var vars = req.route.params;
	var baseURL = 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0';
	var capa = vars.capa + '@EPSG:3857@png8';
	// console.log(req);
	var tileURL = utils.format("%s/%s/%s/%s/%s.%s", baseURL, capa, vars.z, vars.x, vars.y, vars.format + "8");
	var cache = new fc();
	app.addHeader("Content-Type", "image/png");
	res.statusCode = 200;
	cache.on('CACHE_MISS',function MISS(){
		console.log('CACHE MISS:');
		console.log(arguments);
	});
	cache.on('CACHE_HIT',function HIT(){
		console.log('CACHE HIT:');
		console.log(arguments);
	});
	cache.on('data',function(chunk){
		console.log('receiving data: '+chunk.length);
		res.write(chunk);
	});
	cache.on('end', function() {
		res.end();
	});
	cache.get(tileURL);
};


app.route("/tms/:capa/:z/:y/:x.:format", TMSProxy);

app.httpServer.listen(8080, function () {
  console.log("Running now.")
});