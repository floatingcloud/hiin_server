var User = require('../models/user');
var Event = require('../models/event');
var util = require('util');



module.exports = function(app, redis) {


  app.get('/showAllEvent', function(req, res) {
    Event.find(function(err,event){
      res.send(event);
    });
  });

  app.post('/eventAllInfo', function(req, res, next){
    console.log(req.body.code);
    console.log(req.body);
    redis.hgetall('event:'+req.body.code,function(err,event){
      res.send(event);
    });
  });

  app.post('/attendants', function(req, res, next){
    console.log(req.body.code);
    redis.smembers('attendants:'+req.body.code,function(err,event){
      res.send(event);
    });
  });

  app.post('/userInfoAll', function(req, res, next){
    redis.hgetall('user:'+req.body.id,function(err,user){
      res.send(user);
    });
  });

};




