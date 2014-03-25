var crypto = require('crypto');
var fs = require('fs');
var dir = './cache';
var md5sum = crypto.createHash('md5');

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
		return md5sum.update(str).digest('hex');
	};


	this.dir = function(newpath) {
		if(newpath) {
			this._dir = newpath;
		}
		return this._dir;
	};

	this.get = function(url) {
		var hashed = getHash(url);
		if(fs.existsSync(_dir + '/' + hashed)) {
			console.log('file exists: cache hit');
		}else{
			console.log('file not here, should stash as ' + _dir + '/' + hashed);
		}
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

