/* 
 * enter Event
 */

var async = require('async');
var Event = require('../models/event');
var User = require('../models/user');
var mongoose = require('mongoose');

module.exports = function(app, redis, sockets){

  //check passcode
  app.post('/enterEvent', valid_token, function(req, res, next){
        console.log('----enter event----');
        console.log(req.body.code);
      redis.exists("event:"+req.body.code,function(err, val){
          redis.hexists("user:"+req.session.userId+"_event:"+req.body.code,"firstEnterTime",function(err,result){
            if(result === 1)
              console.log('aleady entered no time set');
            else{
            redis.hset("user:"+req.session.userId+"_event:"+req.body.code,"firstEnterTime",(new Date()),function(err, re){
            });
          }
          });
          
          if(val===1){
                  redis.hget("user:"+req.session.userId,"enteredEvent",function(err, reply){
                    if(reply){
                      if(reply === req.body.code){
                        //same event enter
                        redis.hgetall("event:"+req.body.code, function(err, obj){
                              res.send({"status":"0",
                                        "event":obj
                              });
                        });
                        
                      }else{
                        //another event enter : auto switching
                        redis.srem("attendants:"+reply,req.session.userId,function(err,out){
                          console.log("user:"+req.session.userId+" leaves "+reply);
                          redis.hset("user:"+req.session.userId,"enteredEvent",req.body.code,function(err,re){
                            redis.sadd("attendants:"+req.body.code,req.session.userId,function(err,re){
                              console.log("user:"+req.session.userId+" entered "+req.body.code);
                              redis.smembers('attendants:'+req.body.code,function(err,members){
                                console.log('number of members:'+members.length);
                                members.forEach(function(member){
                                  var data = {};
                                  data.targetId = member;
                                  data.messageTpye = "userListChange";
                                  data.message = { "usersNumber":members.length }
                                  sockets.emitTo(data);
                                });
                                //add event in envetlist for login user
                                redis.sadd("eventList:"+req.session.userId,req.body.code,function(err,re){
                                  if(err)console.log('ev err');
                                  else{
                                    console.log(re);
                                    redis.zadd("rank:"+req.body.code,0,req.session.userId,function(err,re){
                                      redis.hgetall("event:"+req.body.code, function(err, obj){
                                        res.send({"status":"0",
                                                 "event":obj
                                        });
                                      });

                                    }
                                              );
                                  }

                                });

                              });

                            });

                          });
                        });

                      }
                    }else{
                      //newer enter
                      redis.hset("user:"+req.session.userId,"enteredEvent",req.body.code,function(err,re){
                        redis.sadd("attendants:"+req.body.code,req.session.userId,function(err,re){
                          console.log("user:"+req.session.userId+" entered "+req.body.code);
                          redis.smembers('attendants:'+req.body.code,function(err,members){
                            console.log('number of members:'+members.length)
                            members.forEach(function(member){
                              var data = {};
                              data.targetId = member;
                              data.messageTpye = "userListChange";
                              data.message = { "usersNumber":members.length }; 
                              sockets.emitTo(data);
                            });
                            //add event in envetlist for login user
                            redis.sadd("eventList:"+req.session.userId,req.body.code,function(err,re){
                              if(err)console.log('ev err');
                              else 
                                {
                                  redis.zadd("rank:"+req.body.code,0,req.session.userId,function(err,re){
                                    redis.hgetall("event:"+req.body.code, function(err, obj){
                                      res.send({"status":"1",
                                               "event":obj
                                      });
                                    });


                                  });

                                }

                            });
                          });
                        });

                      }); 
                    }
                  });
          }else{
            Event.findOne({code: req.body.code}, function(err, result){
                  if(err){
                      res.send("status:-2"); //db fetch error
                      return next(err);
                  }
                  if(result){
                    //redis logic
                    var ekey = "event:"+req.body.code;
                    var attkey = "attendants:"+req.body.code;
                    //redis "event:_code" save event information in hash
                    redis.hset(ekey,"code",req.body.code,function(err,re){
                      redis.hset(ekey,"name",result.name,function(err,re){
                        redis.hset(ekey,"startDate",result.startDate,function(err,re){
                          redis.hset(ekey,"endDate",result.endDate,function(err,re){
                            redis.hset(ekey,"lon",result.lon,function(err,re){
                              redis.hset(ekey,"lat",result.lat,function(err,re){
                                redis.hset(ekey,"desc",result.desc,function(err,re){
                                  redis.hset(ekey,"place",result.place,function(err,re){
                                    redis.hset(ekey,"authorName",result.authorName,function(err,re){
                                      redis.hset(ekey,"author",result.author,function(err,re){
                                        redis.hset(ekey,"regTime",(new Date()),function(err,re){
                                          redis.hset(ekey,"_id",result._id,function(err,re){
                                            //add event in envetlist for login user
                                            redis.sadd("eventList:"+req.session.userId,req.body.code,function(err,re){
                                              if(err)console.log('ev err');
                                              else console.log(re);

                                              //redis "attendants:_code" save userId in list
                                              redis.sadd(attkey,req.session.userId,function(err,re){
                                                console.log("user:"+req.session.userId+" entered "+req.body.code);
                                                //user current event setting in redis in hash
                                                redis.hset("user:"+req.session.userId,"enteredEvent",req.body.code,function(err,re){
                                                  redis.zadd("rank:"+req.body.code,0,req.session.userId,function(err,re){
                                                    redis.hgetall("event:"+req.body.code, function(err, obj){
                                                      res.send({"status":"2",
                                                               "event":obj
                                                      });
                                                    });
                                                  });
                                                });
                                              });
                                            });
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });

                  }else{
                     res.send({"status":"-1"});//not exist event
                  }
           });}

      });

  });
 
  
 //careateEvent
 app.post('/event', valid_token, isOrganizer, function(req, res, next) {
   
    var mkCode;
    var eventDoc = new Object();
    var check=true;
    console.log('---evnet creation---');
    console.log(req.body);

    async.waterfall([
      function (callback) {

        (function codeMaker(){

            mkCode = digitbal(getRandomInt(0,9999),4);
            console.log(mkCode);
            Event.count({code:mkCode},function(err,result){
                
                if(result===0){
                   check = false;
                   console.log('result:'+result);
                   callback(null, 'one');
                }
                if(check === true)
                       codeMaker();
            });
        })();


    },
    function (arg1, callback) {
        eventDoc = {
          code : mkCode,
          name : req.body.name,
          startDate : req.body.startDate,
          endDate : req.body.endDate,
          lon : req.body.lon,
          lat : req.body.lat,
          desc : req.body.desc,
          place : req.body.place,
          authorName : req.session.user.firstName,
          author : req.session.userId
        };
      console.log('sec');
      callback(null, 'two');
    },
    function(arg1, callback){
      console.log('sec2');
      Event.create(eventDoc, function(err,event){
        if(err){
          if(err.code === 11000){
            //corsSend(req, res, 'Conflict');
            res.send({'status':'-1'});
          }else{
            //corsSend(req, res,'server error');
            res.send({'status':'-2'});
            next(err);
          }
        }else{
          //req.session.event = event;
          callback(null, 'two');
          console.log('sec3');

          //res.send({'status':'0',
                   //'eventCode': mkCode
          //});
        }

      });

    }],
    function (err, result) {
      console.log('sec4');
      Event.findOne({code: mkCode}, function(err, result){
        if(err){
          res.send("status:-2"); //db fetch error
          return next(err);
        }
        if(result){
          console.log('result');
          console.log(result);
          //redis logic
          var ekey = "event:"+mkCode;
          var attkey = "attendants:"+mkCode;
          //redis "event:_code" save event information in hash
          redis.hset(ekey,"code", mkCode, function(err,re){
            redis.hset(ekey,"name",result.name,function(err,re){
              redis.hset(ekey,"startDate",result.startDate,function(err,re){
                redis.hset(ekey,"endDate",result.endDate,function(err,re){
                  redis.hset(ekey,"lon",result.lon,function(err,re){
                    redis.hset(ekey,"lat",result.lat,function(err,re){
                      redis.hset(ekey,"desc",result.desc,function(err,re){
                        redis.hset(ekey,"place",result.place,function(err,re){
                          redis.hset(ekey,"authorName",result.authorName,function(err,re){
                            redis.hset(ekey,"author",result.author,function(err,re){
                              redis.hset(ekey,"regTime",(new Date()),function(err,re){
                                redis.hset(ekey,"_id",result._id,function(err,re){
                                  //add event in envetlist for login user
                                  redis.sadd("eventList:"+req.session.userId,mkCode,function(err,re){
                                    if(err)console.log('ev err');
                                    else console.log(re);

                                    //redis "attendants:_code" save userId in list
                                    redis.sadd(attkey,req.session.userId,function(err,re){
                                      console.log("user:"+req.session.userId+" entered "+mkCode);
                                      //user current event setting in redis in hash
                                      redis.hset("user:"+req.session.userId,"enteredEvent",mkCode,function(err,re){
                                        redis.zadd("rank:"+mkCode,0,req.session.userId,function(err,re){
                                          res.send({"status":"0",
                                                   "eventCode":mkCode
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });

        }else{
          res.send({"status":"-1"});//not exist event
        }
      });

    });

  });

  // update event
  app.post('/editEvent', valid_token, is_entered_event, event_owner, function(req, res, next){

    redis.hget("user:"+req.session.userId,"enteredEvent",function(err, reply){
      if(err){
        res.send({"stauts":"-1"});
      }else{
        if(reply){
          var eventDoc = new Object();
          if(req.body.name!=='undefined'){
            eventDoc["name"]=req.body.name;
          }
          if(req.body.startDate!=='undefined'){
            eventDoc["startDate"]=req.body.startDate;
          }
          if(req.body.endDate!=='undefined'){
            eventDoc["endDate"]=req.body.endDate;
          }
          if(req.body.lon!=='undefined'){
            eventDoc["lon"]=req.body.lon;
          }
          if(req.body.lat!=='undefined'){
            eventDoc["lat"]=req.body.lat;
          }
          if(req.body.desc!=='undefined'){
            eventDoc["desc"]=req.body.desc;
          }
          if(req.body.place!=='undefined'){
            eventDoc["place"]=req.body.place;
          }

          Event.update({code:reply},{$set:eventDoc},function(err){
            if(err){ return next(err); }
            else
              {

                redis.hmset('event:'+req.body.code, eventDoc,
                            function(err, re){
                              res.send({'status':'0'});//success update

                            });
              }
          });
        }
        else
          res.send({"stauts":"-1"});
      }
    });

  });



};
