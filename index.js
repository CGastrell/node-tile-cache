var static = require('node-static');

var fileServer = new static.Server('./cache');

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
    	console.log(request.url);
        fileServer.serve(request, response, function (err, result) {
        	if(err) {
        		console.log(err);
        		response.writeHead(err.status, err.headers);
        		response.end();
        	}
        });
    }).resume();
}).listen(8080);