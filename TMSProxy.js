var filecache = require('./Cache')('./cache');

TMSProxy = function (req, res, next) {
	
	var baseURL = 'http://mapa.ign.gob.ar/geoserver/gwc/service/tms/1.0.0';
	var xAndFormatSplit = req.params.xAndFormat.split('.');
	var x = xAndFormatSplit[0];
	var format = xAndFormatSplit[1];
	var capa = req.params.capa + '@EPSG:3857@png8';
	delete req.params.xAndFormat;
	var tileURL = utils.format("%s/%s/%s/%s/%s.%s", baseURL, capa, req.params.z, x, req.params.y, format + "8");

	var data = filecache.get(tileURL);

	res.writeHead(200, {
		'Content-Type': 'image/png',
		'Content-Length': data.length
	});
	res.write(data);
	res.end();
	// res.send({cacheDir: filecache.getPath(tileURL), url: tileURL, some: filecache.get(tileURL), time: new Date()});
};
