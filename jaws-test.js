var jaws = require("jaws");
var utils = require("util");
var cache = require("./Cache")("./cache");
var app = jaws();


TMSProxy = function (req, res) {
	var vars = req.route.params;
	var baseURL = 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0';
	var capa = vars.capa + '@EPSG:3857@png8';
	// console.log(req);
	var tileURL = utils.format("%s/%s/%s/%s/%s.%s", baseURL, capa, vars.z, vars.x, vars.y, vars.format + "8");
	// res.writeHead(200, {"Content-Type": "application/json"});
	// res.write(JSON.stringify(req.route));
	cache._name(tileURL);
	res.end();
	// res.send({cacheDir: filecache.getPath(tileURL), url: tileURL, some: filecache.get(tileURL), time: new Date()});
};


app.route("/tms/:capa/:z/:y/:x.:format", TMSProxy);

app.httpServer.listen(8080, function () {
  console.log("Running now.")
});