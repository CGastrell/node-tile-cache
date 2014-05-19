var koa = require('koa');
var route = require('koa-route');
var app = koa();
var port = process.env.PORT || 5000;

app.use(route.get('/tms/:capa/:z/:x/:y.:format', test));

function *test(capa,z,x,y,format) {
	console.log(arguments);
}

app.listen(port);