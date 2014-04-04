var jaws = require("jaws");
var fc = require("./FileCache");
var tmsProxy = require("./TMSProxy");
var app = jaws();
var port = process.env.PORT || 5000;

// var tmsProxy = new tms();

getTile = function(req, res) {
	tmsProxy.getTile(req, res);
}
cacheStats = function(req, res) {
	var cache = new fc();
	console.log(JSON.stringify(cache.getStats()));
	res.json(cache.getStats());
}


app.route("/tms/:capa/:z/:y/:x.:format", getTile).nocache();
app.route("/cache/status", cacheStats).nocache();

app.httpServer.listen(port, function () {
	console.log("Running now.")
	setInterval(function () {
	  console.log('Flushing data...');
	  app.flush();
	},1000 * 60 * 60);
});

