var restify = require('restify'),
	filecache = require('./FileCache')('./cache');


function respond(req, res, next) {
  res.send('hello ' + req.params.name);
}

//necesito un tms proxy, que tenga un cache, que tenga un filestorage...

TMS_get = function (req, res, next) {
	
	var baseURL = 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0';
	var xAndFormatSplit = req.params.xAndFormat.split('.');
	req.params.x = xAndFormatSplit[0];
	req.params.format = xAndFormatSplit[1];
	req.params.capa += '@EPSG:3857@png8';
	delete req.params.xAndFormat;
	// console.log('fc: '+filecache);
	// res.send(this);
	res.send({cacheDir: filecache.dir(),someHash: filecache.get('http://google.com')});
};

var server = restify.createServer();
server.get('/hello/:name', respond);
server.head('/hello/:name', respond);
server.get('/tms/:capa/:z/:y/:xAndFormat', TMS_get);
//$app->get('/tms/:capa/:z/:y/:x\.:format/status.json', 'Controllers\TMS::status');

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});