var crypto = require('crypto');
var fs = require('fs');
var utils = require('util');

function Cache(path) {
	var _dir = path;

	// console.log(_dir + ' exists?: '+fs.existsSync(_dir));
	if(fs.existsSync(_dir) !== true) {
		throw new Error("Cache :: can't find path");
	};

	var _dirStats = fs.statSync(_dir);

	if(_dirStats.isDirectory() !== true) {
		throw new Error("Cache :: path must be a directory");
	}
	console.log('Cache init on ' + fs.realpathSync(_dir));

	function getHash(str) {
		return crypto.createHash('md5').update(str).digest('hex');
	};
	function name(key) {
		return _dir + "/" + getHash(key);
	};
	function stash(url) {

	};


	this.dir = function(newpath) {
		if(newpath) {
			_dir = newpath;
		}
		console.log(_dir);
		return _dir;
	};
	this.getPath = function(url) {
		return name(url);
	}
	this.get = function(url, expiration) {
		var cachePath = name(url);
		expiration = expiration || 30 * 60 * 60 * 1000;

		if(fs.existsSync(cachePath)) {
			var fileStats = fs.statSync(cachePath);
			if(new Date() - fileStats.ctime.getTime() > expiration) {
				//expicho, hay que buscarlo de nuevo
			}
			fs.readFile(cachePath, function(err, data){
				return data;
			});
		}
		// var req = http.request(options, function(res) {
		// 		console.log('STATUS: ' + res.statusCode);
		// 		console.log('HEADERS: ' + JSON.stringify(res.headers));
		// 		res.setEncoding('utf8');
		// 		res.on('data', function (chunk) {
		// 		console.log('BODY: ' + chunk);
		// 	});
		// });

		console.log(utils.inspect(fileStats));
		// console.log('file not here, should stash as ' + _dir + '/' + hashed);

		return true;
	};

	return this;
}

module.exports = function(path) {

	cache = new Cache(path);


	// cache.dir = function(newpath) {
	// 	if(newpath) {
	// 		dir = newpath;
	// 	}
	// 	return dir;
	// };

	// cache.get = function(url) {
	// 	var hash = getHash(url);
	// 	// fs.stat();
	// 	// JSON.stringify(stats);
	// }
	
	// var s = fs.ReadStream(filename);
	// s.on('data', function(d) {
	//   md5sum.update(d);
	// });

	// s.on('end', function() {
	//   var d = md5sum.digest('hex');
	//   console.log(d + '  ' + filename);
	// });
	return cache;
}

