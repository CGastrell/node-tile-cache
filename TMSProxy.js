var utils = require("util");
var fc = require("./FileCache");

TMSProxy = function (req, res) {
	// var vars = req.route.params;
	// var baseURL = 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0';
	// var capa = vars.capa + '@EPSG:3857@png8';
	// // console.log(req);
	// var tileURL = utils.format("%s/%s/%s/%s/%s.%s", baseURL, capa, vars.z, vars.y, vars.x, vars.format + "8");
	this.baseURL = 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0';
	this.cache = new fc();
	this.res = null;
	// app.addHeader("Content-Type", "image/png");
	// res.statusCode = 200;
	var _this = this;
	this.cache.on('cache_miss',function MISS(){
		console.log('CACHE MISS:');
		console.log(arguments);
	});
	this.cache.on('cache_hit',function HIT(){
		console.log('CACHE HIT:');
		console.log(arguments);
	});
	this.cache.on('data',function(chunk){
		if(!_this.res) return;
		console.log('receiving data: '+chunk.length);
		_this.res.write(chunk);
	});
	this.cache.on('end', function() {
		if(!_this.res) return;
		console.log('end');
		console.log(arguments);
		_this.res.end();
	});
	// cache.get(tileURL);
};
TMSProxy.prototype.setResponse = function(res) {
	this.res = res;
	this.res.writeHead(200, {'Content-Type': 'image/png' });
}
TMSProxy.prototype.buildUrl = function(params) {
	var vars = params;
	var capa = vars.capa + '@EPSG:3857@png8';
	// console.log(req);
	var tileURL = utils.format("%s/%s/%s/%s/%s.%s", this.baseURL, capa, vars.z, vars.y, vars.x, vars.format + "8");
	return tileURL;
}
TMSProxy.prototype.getTile = function(req, res) {
	var url = this.buildUrl(req.route.params);
	this.setResponse(res);
	this.cache.get(url);
}
module.exports = new TMSProxy();