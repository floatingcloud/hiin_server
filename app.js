/*
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');
var redis = require('redis').createClient();
var sessionRedis = require('redis').createClient();
var dbURL = 'mongodb://localhost/test';
var db = require('mongoose').connect(dbURL);
var mongoose = require('mongoose');
var session = require('express-session');
var apn = require('apn');
var gcm = require('node-gcm');

//var MongoStore = require('connect-mongo')(express);
var RedisStore = require('connect-redis')(session);
//var passport = require('passport')
//var FacebookStrategy = require('passport-facebook').Strategy;
var nconf = require('nconf');
var config = require('./config/oauth.js');
//var MemoryStore = require('express/node_modules/connect/lib/middleware/session/memory');
var session_store = new RedisStore({  
                                      client:sessionRedis});
//var session_store = new MongoStore({ db : 'hiin' });
var connect = require('express/node_modules/connect');

var app = express();
var server = http.createServer(app);
var socket_io = require('socket.io');
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Credentials", 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
//http://ec2-54-209-162-175.compute-1.amazonaws.com/index.html
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

// for redis quir on preocess quit
process.on('exit', function(){
  reids.quit();
});

redis.on("error", function(err){
  console.log("Error"+err);
});

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(session({store: session_store,
                         maxAge: new Date(Date.now() + 3600000),
                         secret: "rlaeodnjs",
                         resave: true,
                         saveUninitialized: true
                        }));
app.use(allowCrossDomain);
app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/ping', function(req, res) {
    res.send('pong');
});

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//set socket server
var io = socket_io.listen(server);

// set nconf
nconf.file('../config/config.json');

//apn test
//var options = { 
  //gateway : "gateway.sandbox.push.apple.com", 
  //cert: './cert/cert.pem',
  //key: './cert/key.pem'	
//};

//var apnConnection = new apn.Connection(options);
//var myDevice = new apn.Device('0b7c8b0624d74e905e0892e69c8300e4dfa821a0f02a35e427d908fe896d1827');

//var note = new apn.Notification();
//note.badge = 3;
//note.alert = 'hiin 푸시 테스트';
//note.payload = {'message': '안녕하세요'};

//apnConnection.pushNotification(note, myDevice);


//require
require('./routes/global')(nconf, redis);
require('./routes/eventHandler')(app, redis, io.sockets.sockets);
require('./routes/loginHandler')(app, redis, io.sockets.sockets);
require('./routes/userHandler')(app, redis);
require('./routes/admin')(app,redis);

//socket.io server starting
require('./routes/socketHandler')(io, redis, connect, session_store, apn, gcm);


//web starting server 
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
