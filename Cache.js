var crypto = require('crypto');
var fs = require('fs');
var utils = require('util');
var http = require('http');

function Cache(path) {
	this._dir = path;

	// console.log(_dir + ' exists?: '+fs.existsSync(_dir));
	if(fs.existsSync(this._dir) !== true) {
		throw new Error("Cache :: can't find path");
	};

	// var _dirStats = fs.statSync(this._dir);

	if(fs.statSync(this._dir).isDirectory() !== true) {
		throw new Error("Cache :: path must be a directory");
	}
	console.log('Cache init on ' + fs.realpathSync(this._dir));
	this._fileData = null;
};

Cache.prototype._hash = function(str) {
	return crypto.createHash('md5').update(str).digest('hex');
};

Cache.prototype._name = function(key) {
	return this._dir + "/" + this._hash(key);
};

Cache.prototype.dir = function(newpath) {
	if(newpath) {
		this._dir = newpath;
	}
	console.log(this._dir);
	return this._dir;
};

Cache.prototype.getPath = function(url) {
	return this._name(url);
};

Cache.prototype.get = function(url, expiration) {
	var cachePath = this._name(url);
	var _this = this;
	expiration = expiration || 30 * 60 * 60 * 1000;

	if(fs.existsSync(cachePath)) {
		console.log('File is cached at '+cachePath);
		var fileStats = fs.statSync(cachePath);
		if(new Date() - fileStats.ctime.getTime() > expiration) {
			//expicho, hay que buscarlo de nuevo
		}
		return fs.readFileSync(cachePath);
	}
	// var req = http.request({}, function(res) {
	// 		console.log('STATUS: ' + res.statusCode);
	// 		console.log('HEADERS: ' + JSON.stringify(res.headers));
	// 		res.setEncoding('utf8');
	// 		res.on('data', function (chunk) {
	// 		console.log('BODY: ' + chunk);
	// 	});
	// });

	var handler = function(data) {
		return data;
	}

	var r = http.request({
		host: '172.20.203.111',
		port: 3128,
		path: url
	}, function(res) {
		console.log('Got response');
	  	console.log(arguments);
	  	res.on('data',handler);
	});

	r.on('error', function(e) {
	  console.log("Got error: " + e.message);
	});
	r.end();

	// console.log(utils.inspect(fileStats));
	// console.log('file not here, should stash as ' + _dir + '/' + hashed);

	// return true;
};


// module.exports = (function(dir){ return new Cache(dir)}(dir));

module.exports = function(path) {

	cache = new Cache(path);

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

