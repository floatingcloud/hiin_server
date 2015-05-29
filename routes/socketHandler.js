/*
 * envet chat routing 
 */
var async = require('async');
var Event = require('../models/event');
var User = require('../models/user');
var Message = require('../models/message');
var mongoose = require('mongoose');
var options = {
  gateway : "gateway.push.apple.com", 
  cert: './cert/apns-pro-cert.pem',
  key: './cert/apns-pro.pem'	
};

module.exports = function(io, redis, connect, sessionStore, apn, gcm) {

  io.configure(function(){
    io.set('log level',1);
    io.set('transports', [
        'websocket'
      , 'flashsocket'
      , 'htmlfile'
      , 'xhr-polling'
      , 'jsonp-polling'
    ]);

    io.set('authorization', function(data, accept){

      try{
        console.log('token:'+data.query.token);
        if (data.query.token === undefined || data.query.token.length === 0){
          console.log('no token set in client');
          accept('ERROR', false);
          console.log('error2');
        }else{
          redis.hexists('token',data.query.token,function(err,result){
            if(result === 1){
              console.log('valid_token');
              redis.hget('token',data.query.token,function(err,userId){
                data.userId = userId;
                console.log("socket:"+userId+'success handshake');
                accept(null,true);
              });
            } else{
              console.log('no token in server');
              accept('ERROR', false);
              console.log('error1');
            }
          });

        }

      }catch(error){
        console.log("error3"+error);
        accept('ERROR3', false);
      }
  
    });  

  });


  var Hiin = io
    .of('/hiin')
    .on('connection', function(socket) {

      var userId = socket.handshake.userId;

      //user socket.id set in redis
      redis.lpush('sockets:'+userId,socket.id,function(err,re){
        redis.hset('user:'+userId,'status','on',function(err,re){
          redis.llen('sockets:'+userId,function(err,cnt){
            console.log(userId+":socket count:"+cnt);
          });
        });
      });


      //initiall connection
      socket.on('connectEvent', function() {
        var data = { targetId : userId , 
                     messageTpye : 'connected',
                     message : 'connected'
                   }
        io.of('/hiin').sockets.emitTo(data); 

      });
        
      //login user's event list return 
      socket.on('enteredEventList',function(){
        var evList=new Array();
        async.series([function(callback){
          redis.smembers("eventList:"+userId,function(err,events){
            console.log('member');
            console.log(events);
            events.forEach(function(event){
              redis.hgetall('event:'+event,function(err,info){
                if(err){
                }else{
                  console.log(info);
                  evList.push(info);
                }
              });

            });
            callback(null,'ok');
          });
        },
        function(callback){
          callback(null,'push ok');
        }]
        ,function(err, result){

        var sdata = { targetId : userId , 
          messageTpye : 'enteredEventList',
          message : evList 
        }
        console.log('---sdata---');
        console.log(sdata);

        io.of('/hiin').sockets.emitPass(sdata);
        });
        

      });

      //user status change in reconnect
      socket.on('resume',function(){
        redis.hset('user:'+userId,'status','on',function(err,re){
          console.log('user:'+userId+"form sleep and status on");
        });
      });

      //event information return 
      socket.on('eventInfo', function(data) {
        console.log("einfo");
        var sdata = new Object();
          redis.hgetall("event:"+data.code, function(err, obj){
              sdata = { targetId : userId, 
                        messageTpye : 'eventInfo',
                        message : obj
                      }
              io.of('/hiin').sockets.emitPass(sdata);
          });

      });
      //current evetn info return 
      socket.on('currentEvent', function(data) {
        redis.hget("user:"+userId,"enteredEvent",function(err, reply){
          var sdata = new Object();
          redis.hgetall("event:"+reply, function(err, obj){
            sdata = { targetId : userId, 
              messageTpye : 'currentEvent',
              message : obj
            }
            io.of('/hiin').sockets.emitPass(sdata);
          });
        });
      });

      //return currentEventUserList without me
      socket.on('currentEventUserList', function(){
        //accept : 3, request:1, pending:2, else :0
        var usersInfo = new Array();
        console.log('-----------------------------currentEventUserList----------------------------');
        async.waterfall([function(callback){
          console.log('user:'+userId);
          redis.hget("user:"+userId,"enteredEvent",function(err, reply){
            console.log('enterEvnet:'+reply);
            redis.smembers('attendants:'+reply,function(err,members){
              console.log('----members------');
              console.log(members);
              console.log('-----------------');
              async.forEach(members,function(member, done) {

                if ( member === 'undefined'){
                  done();
                }else if(member === undefined){
                  done();
                }else{

                  Message.find({$and:[
                    {reciever:userId},
                    {sender:member},
                    {eventCode:reply},
                    {read:false},
                    {type:'personal'}
                  ]})
                  .sort({created_at:-1})
                  .limit(1)
                  .exec(function(err,lstMsg){
                    console.log('---last msg--');
                    console.log(lstMsg);
                    console.log('------------');

                    if(member !== userId){
                      redis.hgetall("user:"+member,function(err,obj){
                        if(lstMsg.length > 0){
                          obj["unread"]=true;
                        }else{
                          obj["unread"]=false;
                        }
                        redis.zrevrank("rank:"+reply,member,function(err,rank){
                          obj["rank"]=rank+1;
                          redis.sismember("user:"+userId+"_event:"+reply+"_acceptHi",member,function(err,result){
                            if(result === 1){
                              obj["status"]='3';
                              usersInfo.push(obj);
                              done();
                            }else{
                              redis.sismember("user:"+userId+"_event:"+reply+"_requestHi",member,function(err,result){
                                if(result === 1){
                                  obj["status"]='1';
                                  usersInfo.push(obj);
                                  done();
                                }else{
                                  redis.sismember("user:"+userId+"_event:"+reply+"_pendingHi",member,function(err,result){
                                    if(result === 1){
                                      obj["status"]='2';
                                      usersInfo.push(obj);
                                      done();
                                    }else{
                                      obj["status"]='0';
                                      usersInfo.push(obj);
                                      done();
                                    }
                                  });
                                }
                              });
                            }
                          });

                        });
                      });}else{
                        done();
                      }
                  });
                }
              //forEach end

              },function(err) {
                callback(null);
              }
            );
              });
          });},
          function(callback){
            callback(null,'push ok');
          }],
          function(err, result){
            //console.log('cuserlist');
              
              var sdata = { targetId : userId , 
                           messageTpye : 'currentEventUserList',
                           message : usersInfo 
                         }
                         console.log(usersInfo);
              io.of('/hiin').sockets.emitPass(sdata);
          });
      });

      //"hi" functionality implementaion
      socket.on('hi', function(data){
        console.log('hi event');

        redis.hget("user:"+userId,"enteredEvent",function(err, reply){
          redis.hgetall("user:"+userId, function(err,userIf){
            var ukey = "user:"+userId+"_event:"+reply;
            var okey = "user:"+data.targetId+"_event:"+reply;
            redis.sismember(ukey+"_pendingHi",data.targetId,function(err, result){
              if(result === 0){ // target not exist press user's pending list
                redis.sadd(ukey+"_requestHi",data.targetId,function(err,re){
                  console.log(data.targetId+" inserts "+ukey+"_requestHi"); 
                  redis.sadd(okey+"_pendingHi",userId,function(err,re){
                    console.log(userId+" inserts "+okey+"_pendingHi");
                    redis.hget("user:"+userId,"firstName",function(err, fim){
                      redis.zincrby("rank:"+reply,1,userId,function(err,re){
                        redis.hmget("user:"+data.targetId,'device','deviceToken',"enteredEvent",function(err, targetInfo){
                          console.log("user:"+data.targetId+"rank:"+re);
                          console.log(targetInfo);
                          var msg = new Message({
                            sender: userId,
                            reciever: data.targetId,
                            content: '',
                            type:'hi',
                            eventCode: reply,
                            created_at: new Date(),
                          });
                          msg.save(function(err,ms){
                            if(err)
                              console.log('err to  write hi msg  in db');
                            else{
                              console.log('success to write hi msg in db');
                              if( reply == targetInfo[2])
                                {
                                  var obj = {  'status' : '1',
                                    'from' : userId,
                                    'fromName' :fim,
                                    'userObj' : userIf,
                                    'regTime' : new Date()
                                  }
                                  var sdata = { targetId : data.targetId , 
                                    messageTpye : 'hi',
                                    message : obj
                                  }
                                  var sdataMe = { targetId : userId , 
                                    messageTpye : 'hiMe',
                                    message : obj
                                  }
                                  io.of('/hiin').sockets.emitPass(sdata);
                                  io.of('/hiin').sockets.emitPass(sdataMe);
                                  if(targetInfo[0]=='ios'){

                                    var apnConnection = new apn.Connection(options);
                                    var myDevice = new apn.Device(targetInfo[1]);
                                    var note = new apn.Notification();
                                    var pack = { 'type':'hi',
                                      'code': reply};

                                      note.alert = fim + ' sent \'HI!\''
                                      note.sound = "default.aiff";
                                      note.payload = {'message': pack};

                                    Message.count({
                                      $and:[
                                        {sender: { $ne: data.targetId }},
                                        {reciever:data.targetId},
                                        {eventCode:reply},
                                        {$or:[{type:'personal'},{type:'notice'}]},
                                        {read:false}
                                      ]
                                    },function(err,cnt){
                                        note.badge = cnt;
                                        console.log('per chat db----');
                                        console.log(cnt);
                                        console.log('badge:'+note.badge);
                                        apnConnection.pushNotification(note, myDevice);
                                      });
                                  }else if(targetInfo[0]=='android'){
                                    // create a message with default values
                                    //var message = new gcm.Message();
                                    console.log('device key android:'+targetInfo[1]);

                                    // or with object values
                                    var message = new gcm.Message({
                                      data: {
                                        message: fim + ' sent \'HI!\'',
                                        payload: fim + ' sent \'HI!\'',
                                        type: 'hi',
                                        id: userId
                                      }
                                    });
                                    var server_access_key = 'AIzaSyClYplgFN-Qx-xW1zNAYqMP1XL78JF9JzI';
                                    var sender = new gcm.Sender(server_access_key);
                                    var registrationIds = [];
                                    var registration_id = targetInfo[1];
                                    // At least one required
                                    registrationIds.push(registration_id);

                                    /**
                                     * Params: message-literal, registrationIds-array, No. of retries, callback-function
                                     **/
                                    Message.count({
                                      $and:[
                                        {sender: { $ne: data.targetId }},
                                        {reciever:data.targetId},
                                        {eventCode:reply},
                                        {$or:[{type:'personal'},{type:'notice'}]},
                                        {read:false}
                                      ]
                                    },function(err,cnt){
                                      message.addData('badge',cnt);
                                      console.log('per chat db----');
                                      console.log(cnt);
                                      console.log('badge:'+cnt);
                                      sender.send(message, registrationIds, 4, function (err, result) {
                                        console.log('----------android push--------------re');
                                        console.log(result);
                                      });
                                    });

                                  }
                                }else{
                                  console.log(data.targetId+'different event entered no push and hi');

                                }
                            }
                          });
                        });
                      });//zinc
                    });
                  });
                });
              }else{ //target in user's pending list
                redis.srem(ukey+"_pendingHi",data.targetId,function(err, result){
                  console.log(data.targetId+" removes "+ukey+"_pendingHi");
                  redis.sadd(ukey+"_acceptHi",data.targetId,function(err, result){
                    console.log(data.targetId+" inserts "+ukey+"_acceptHi");
                    redis.srem(okey+"_requestHi",userId,function(err, result){
                      console.log(userId+" removes "+okey+"_requestHi");
                      redis.sadd(okey+"_acceptHi",userId,function(err, result){
                        console.log(userId+" inserts "+okey+"_acceptHi");
                        redis.hget("user:"+userId,"firstName",function(err, fim){
                          redis.zincrby("rank:"+reply,1,userId,function(err,re){
                            redis.hmget("user:"+data.targetId,'device','deviceToken',"enteredEvent",function(err, targetInfo){
                              console.log(targetInfo);
                              console.log("user:"+data.targetId+"rank:"+re);
                              var msg = new Message({
                                sender: userId,
                                reciever: data.targetId,
                                content: '',
                                type:'hi',
                                eventCode: reply,
                                created_at: new Date(),
                                read : true
                              });
                              msg.save(function(err,ms){
                                if(err)
                                  console.log('err to  write hi msg  in db');
                                else{
                                  console.log('success to write hi msg in db');
                                  if( reply == targetInfo[2])
                                    {
                                      var obj = {  'status' : '1',
                                        'from' : userId,
                                        'fromName' :fim,
                                        'regTime' : new Date(),
                                        '_id' : msg._id

                                      }
                                      if(targetInfo[0]=='ios'){

                                        var apnConnection = new apn.Connection(options);
                                        var myDevice = new apn.Device(targetInfo[1]);
                                        var note = new apn.Notification();
                                        note.alert = fim + ' sent \'HI!\''
                                        note.sound = "default.aiff";
                                        note.payload = {'message': 'hi'};

                                        Message.count({
                                          $and:[
                                            {sender: { $ne: data.targetId }},
                                            {reciever:data.targetId},
                                            {eventCode:reply},
                                            {$or:[{type:'personal'},{type:'notice'}]},
                                            {read:false}
                                          ]
                                        },function(err,cnt){
                                          note.badge = cnt;
                                          console.log('per chat db----');
                                          console.log(cnt);
                                          console.log('badge:'+note.badge);
                                          apnConnection.pushNotification(note, myDevice);
                                        });
                                      }else if(targetInfo[0]=='android'){
                                        // create a message with default values
                                        //var message = new gcm.Message();
                                        console.log('device key android:'+targetInfo[1]);

                                        // or with object values
                                        var message = new gcm.Message({
                                          data: {
                                            message: fim + ' sent \'HI!\'',
                                            payload: fim + ' sent \'HI!\'',
                                            type: 'hi'
                                          }
                                        });
                                        var server_access_key = 'AIzaSyClYplgFN-Qx-xW1zNAYqMP1XL78JF9JzI';
                                        var sender = new gcm.Sender(server_access_key);
                                        var registrationIds = [];
                                        var registration_id = targetInfo[1];
                                        // At least one required
                                        registrationIds.push(registration_id);

                                        /**
                                         * Params: message-literal, registrationIds-array, No. of retries, callback-function
                                         **/
                                        Message.count({
                                          $and:[
                                            {sender: { $ne: data.targetId }},
                                            {reciever:data.targetId},
                                            {eventCode:reply},
                                            {$or:[{type:'personal'},{type:'notice'}]},
                                            {read:false}
                                          ]
                                        },function(err,cnt){
                                          message.addData('badge',cnt);
                                          console.log('per chat db----');
                                          console.log(cnt);
                                          console.log('badge:'+cnt);
                                          sender.send(message, registrationIds, 4, function (err, result) {
                                            console.log('----------android push--------------re');
                                            console.log(result);
                                          });
                                        });
                                      }

                                      var sdata = { targetId : data.targetId , 
                                        messageTpye : 'hi',
                                        message : obj
                                      }
                                      var sdataMe = { targetId : userId, 
                                        messageTpye : 'hiMe',
                                        message : obj
                                      }
                                      io.of('/hiin').sockets.emitPass(sdata);
                                      io.of('/hiin').sockets.emitPass(sdataMe);
                                    }else{
                                      console.log(data.targetId+'different event entered no push and hi');
                                    }
                                }
                              });
                            });
                          });
                        });

                      });

                    });

                });

              });
            }
          });
          });
        });
      });
      
      //single user infomation return 
      socket.on('getUserInfo', function(data){
        redis.hgetall("user:"+data.targetId,function(err, user){
            var sdata = { targetId : userId , 
                           messageTpye : 'getUserInfo',
                           message : user 
                         }
              io.of('/hiin').sockets.emitPass(sdata);
        
        });

      });

      //message 'read' api implementation
      socket.on('read', function(data){
        Message.update({_id:data.msgId},{$set:{read:true}},function(err,msg){
          console.log(msg);
          if(err)
            console.log(err);
          else{
            console.log('Message:'+data.msgId+'read');
          }
        });

      });
      //message 'readHi' api implementation
      socket.on('readHi', function(data){
        console.log('readhi');
        console.log(data);
        console.log(userId);
        Message.update({
          $and:[
            {reciever:userId},
            {sender:data.partner},
            {eventCode:data.code},
            {type:'hi'},
          ]
        },{$set:{read:true}},function(err,hi){
          console.log('----hi back----');
          console.log(hi);
          console.log('---------------');
          if(err)
            console.log('fail hi read');
          else
            console.log('hi read')
        });
      });

      //loadPersonal message personal msg:all msg load initially because all message is not red msg
      socket.on('loadMsgs', function(data){
       console.log('load msg');
       console.log(data);
       if(data.type == 'personal'){
         if(data.range == 'all'){
           console.log('all fetch');
           Message.find({$or:[{reciever:userId, sender:data.partner, eventCode:data.code, type:'personal'}
                              ,{reciever:data.partner, sender:userId, eventCode:data.code, type:'personal'}]})
                  .sort({created_at:1})
                  .exec(function(err,msgs){
                    var packing = {
                                    message: msgs,
                                    type: 'personal',
                                    range: 'all'
                    }

                    var sdata = { targetId : userId , 
                           messageTpye : 'loadMsgs',
                           message : packing 
                         }
                    io.of('/hiin').sockets.emitPass(sdata);
                    msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
                  });
         }else if(data.range == 'pastThirty'){
            console.log('pastThirty');
            Message.find({
                            $and:[
                                    {$or:[{reciever:userId},{reciever:data.partner}]},
                                    {$or:[{sender:userId},{sender:data.partner}]},
                                    {eventCode:data.code},
                                    {type:'personal'},
                                    {created_at:{$lt:data.firstMsgTime}}
                            ]
                   })
                   .sort({created_at:-1})
                   .limit(30)
                   .exec(function(err,msgs){
                      console.log(msgs);
                      var packing = {
                                      message: msgs,
                                      type: 'personal',
                                      range: 'pastThirty'
                      }

                      var sdata = { targetId : userId , 
                             messageTpye : 'loadMsgs',
                             message : packing 
                           }
                      io.of('/hiin').sockets.emitPass(sdata);
                      msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
                    });
         }else if(data.range == 'unread'){
           console.log('---unread-----');
           Message.find({
                            $and:[
                                    {$or:[{reciever:userId},{reciever:data.partner}]},
                                    {$or:[{sender:userId},{sender:data.partner}]},
                                    {eventCode:data.code},
                                    {type:'personal'},
                                    {created_at:{$gt:data.lastMsgTime}}
                            ]
                   })
                   .sort({created_at:1})
                   .exec(function(err,msgs){
                      console.log(msgs);
                      var packing = {
                                      message: msgs,
                                      type: 'personal',
                                      range: 'unread'
                      }

                      var sdata = { targetId : userId , 
                        messageTpye : 'loadMsgs',
                        message : packing 
                      }
                      io.of('/hiin').sockets.emitPass(sdata);
                      msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
                   });
         }
       }else if(data.type == 'group'){
         if(data.range == 'blank'){
           console.log('blank fetch');
           redis.hget("user:"+userId+"_event:"+data.code,"firstEnterTime",function(err,result){
             console.log('enterTime:'+result);
             Message.find({
               $and:[
                 {reciever:userId},
                 {eventCode:data.code},
                 {$or:[{type:'group'},{type:'notice'}]},
                 {created_at:{$gt:result}}
               ]
             })
             .sort({created_at:-1})
             .limit(30)
             .exec(function(err,msgs){
               console.log('------blank-------');
               console.log(msgs);
               var packing = {
                 message: msgs,
                 type: 'group',
                 range: 'blank'
               }

               var sdata = { targetId : userId , 
                 messageTpye : 'loadMsgs',
                 message : packing 
               }
               io.of('/hiin').sockets.emitPass(sdata);
               msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
             });
           });

         }else if(data.range == 'pastThirty'){
           console.log('pastThirty');
           redis.hget("user:"+userId+"_event:"+data.code,"firstEnterTime",function(err,result){
             console.log('enterTime:'+result);
             Message.find({
               $and:[
                 {reciever:userId},
                 {eventCode:data.code},
                 {$or:[{type:'group'},{type:'notice'}]},
                 {created_at:{$gt:result,$lt:data.firstMsgTime}}
               ]
             })
             .sort({created_at:-1})
             .limit(30)
             .exec(function(err,msgs){
               console.log('------pastThirty-------');
               console.log(msgs);
               var packing = {
                 message: msgs,
                 type: 'group',
                 range: 'pastThirty'
               }

               var sdata = { targetId : userId , 
                 messageTpye : 'loadMsgs',
                 message : packing 
               }
               io.of('/hiin').sockets.emitPass(sdata);
               msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
             });
           });
         }else if(data.range == 'unread'){
           console.log('---unread-----');
           Message.find({
             $and:[
               {reciever:userId},
               {eventCode:data.code},
               {$or:[{type:'group'},{type:'notice'}]},
               {created_at:{$gt:data.lastMsgTime}}
             ]
           })
           .sort({created_at:1})
           .exec(function(err,msgs){
             console.log(msgs);
             var packing = {
               message: msgs,
               type: 'group',
               range: 'unread'
             }

             var sdata = { targetId : userId , 
               messageTpye : 'loadMsgs',
               message : packing 
             }
             io.of('/hiin').sockets.emitPass(sdata);
             msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
           });
         }


       }else{
         console.log('else group load');
       }
      });


      //group msg function
      socket.on('groupMessage', function(data){
        console.log('---gr---');
        console.log(data);
        redis.hgetall("user:"+userId,function(err, user){
          redis.smembers('attendants:'+user.enteredEvent,function(err,members){
            members.forEach(function(member){
              redis.hmget('user:'+member,'device','deviceToken','enteredEvent',function(err, targetInfo){
                var msg = new Message({
                  status: '0',
                  sender: userId,
                  sender_name: user.firstName,
                  reciever: member,
                  thumbnailUrl: user.thumbnailUrl,
                  content: data.message,
                  type:'group',
                  eventCode: user.enteredEvent,
                  created_at: new Date()
                });
                var sndMsg = user.firstName + ' : ' + data.message;
                msg.save(function(err,ms){
                  if(err)
                    console.log('err to  write gr msg in db');
                  else{
                    console.log('success to write gr msg in db');
                    console.log(targetInfo);

                    if( user.enteredEvent == targetInfo[2])
                      {
                        redis.lrange('sockets:'+member,0,-1,function(err, socs){
                          if(socs){
                            socs.forEach(function(soc){
                              try{

                                io.of('/hiin').sockets[soc].emit('groupMessage',ms);

                              }catch(err){
                                redis.lrem('sockets:'+member,-1,soc,function(err,re){
                                  console.log('dumy sockets remove:'+soc);    
                                });
                              }
                            });
                          }else{
                            //no socket exist in target
                            console.log('target:'+member+' has no socket');
                          }
                        });
                        if(targetInfo[0]=='ios'){
                          var apnConnection = new apn.Connection(options);
                          apnConnection.on('error', function(err) {
                            return console.log("[apn-connection] error: " + err);
                          });

                          apnConnection.on('transmitted', function() {
                            return console.log('[apn-connection] transmitted');
                          });

                          apnConnection.on('timeout', function() {
                            return console.log('[apn-connection] timeout');
                          });

                          apnConnection.on('connected', function() {
                            return console.log('[apn-connection] connected');
                          });

                          apnConnection.on('disconnected', function() {
                            return console.log('[apn-connection] disconnected');
                          });

                          apnConnection.on('socketError', function(err) {
                            return console.log("[apn-connection] socketError: " + err);
                          });

                          apnConnection.on('transmissionError', function(err) {
                            return console.log("[apn-connection] transmissionError: " + err);
                          });

                          apnConnection.on('cacheTooSmall', function() {
                            return console.log('[apn-connection] cacheTooSmall');
                          });
                          var myDevice = new apn.Device(targetInfo[1]);
                          var note = new apn.Notification();
                          var pack = { 'type':'group',
                            'code': user.enteredEvent};
                            note.alert = sndMsg;
                            note.sound = "default.aiff";
                            note.payload = {'message': pack };
                            Message.count({
                              $and:[
                                {sender: { $ne: member }},
                                {reciever:member},
                              {eventCode:user.enteredEvent},
                              {$or:[{type:'personal'},{type:'notice'}]},
                              {read:false}
                            ]
                          },function(err,cnt){
                            note.badge = cnt;
                            console.log('per chat db----');
                            console.log(cnt);
                            console.log('badge:'+note.badge);
                            apnConnection.pushNotification(note, myDevice);
                          });
                        }else if(targetInfo[0]=='android'){
                          // create a message with default values
                          //var message = new gcm.Message();
                          console.log('device key android:'+targetInfo[1]);

                          // or with object values
                          var message = new gcm.Message({
                            data: {
                              message: sndMsg,
                              payload: sndMsg,
                              type: 'group',
                              code: user.enteredEvent
                            }
                          });
                          var server_access_key = 'AIzaSyClYplgFN-Qx-xW1zNAYqMP1XL78JF9JzI';
                          var sender = new gcm.Sender(server_access_key);
                          var registrationIds = [];
                          var registration_id = targetInfo[1];
                          // At least one required
                          registrationIds.push(registration_id);

                          /**
                           * Params: message-literal, registrationIds-array, No. of retries, callback-function
                           **/
                           Message.count({
                            $and:[
                              {sender: { $ne: member }},
                              {reciever:member},
                              {eventCode:user.enteredEvent},
                              {$or:[{type:'personal'},{type:'notice'}]},
                              {read:false}
                            ]
                          },function(err,cnt){
                            message.addData('badge',cnt);
                            console.log('group chat db----');
                            console.log(cnt);
                            console.log('badge:'+cnt);
                            sender.send(message, registrationIds, 4, function (err, result) {
                              console.log('----------android push--------------re');
                              console.log(result);
                            });
                          });

                        }
                      }else{
                        console.log(member+'different event entered no push and msg');

                      }
                  }
                });
              });
            });//here forEach
          });
        });
      });

      //login user information return
      socket.on('myInfo', function(){
        redis.hgetall('user:'+userId, function(err, user){
            var sdata = { targetId : userId , 
                           messageTpye : 'myInfo',
                           message : user 
                         }
              io.of('/hiin').sockets.emitPass(sdata);

        });
      });
      
      //activity
      socket.on('activity', function(){
        console.log('----activity-----');
        var userRank;
        var usersInfo = new Array();
        async.waterfall([
          function(callback){
          redis.hget("user:"+userId,"enteredEvent",function(err, reply){
            redis.smembers('attendants:'+reply,function(err,members){
              async.forEach(members,function(member, done) {
                if(member !== userId){
                  console.log('---inner bound---');
                  Message.find({$and:[
                                    {$or:[{reciever:userId},{reciever:member}]},
                                    {$or:[{sender:userId},{sender:member}]},
                                    {eventCode:reply},
                                    {$or:[{type:'personal'},{type:'hi'}]}
                  ]})
                  .sort({created_at:-1})
                  .limit(1)
                  .exec(function(err,lastMsg){
                    console.log('---inner bound22---');
                    console.log(lastMsg);
                    if(lastMsg.length>0){
                        redis.hgetall("user:"+member,function(err,obj){
                          obj["lastMsg"] = lastMsg[0];
                          if(userId === lastMsg[0].sender)
                            obj["lastSender"] = 'me'
                          else
                            obj["lastSender"] = 'you'
                          redis.sismember("user:"+userId+"_event:"+reply+"_acceptHi",member,function(err,result){
                            if(result === 1){
                              obj["status"]='3';
                              usersInfo.push(obj);
                              done();
                            }else{
                              redis.sismember("user:"+userId+"_event:"+reply+"_requestHi",member,function(err,result){
                                if(result === 1){
                                  obj["status"]='1';
                                  usersInfo.push(obj);
                                  done();
                                }else{
                                  redis.sismember("user:"+userId+"_event:"+reply+"_pendingHi",member,function(err,result){
                                    if(result === 1){
                                      obj["status"]='2';
                                      usersInfo.push(obj);
                                      done();
                                    }else{
                                      obj["status"]='0';
                                      usersInfo.push(obj);
                                      done();
                                    }
                                  });
                                }
                              });
                            }
                          });
                        });
                      }else{
                        done();
                      }

                    });
                }else
                  {
                    done();
                  }
              }
              ,function(err) {
            callback(null,reply);
              }     
                           );
            });
          });
        },
        function(enterEventCode,callback){
          console.log('-----call2----');
          redis.zrevrank("rank:"+enterEventCode,userId,function(err,rank){
            userRank = rank;
            callback(null);
          });


        }
        ], function (err, result) {
          var ob = {
            rank : (userRank+1),
            activity : usersInfo
          }
          var sdata = { targetId : userId , 
            messageTpye : 'activity',
            message : ob 
          }
          console.log('acti');
          io.of('/hiin').sockets.emitPass(sdata);
        });
      });



      //msg for personal chat
      socket.on('message', function(data){
        redis.hgetall('user:'+userId, function(err, user){
          redis.hmget('user:'+data.targetId,'device','deviceToken','enteredEvent',function(err, targetInfo){
            var msg = new Message({
              status: '0',
              sender: userId,
              sender_name: user.firstName,
              reciever: data.targetId,
              thumbnailUrl: user.thumbnailUrl,
              content: data.message,
              type:'personal',
              eventCode: user.enteredEvent,
              created_at: data.created_at 
            });
            var sndMsg = user.firstName + ' : ' + data.message;
            msg.save(function(err,ms){
              if(err)
                console.log('err to  write msg in db');
              else{
                console.log('success to write msg in db');

                if( user.enteredEvent == targetInfo[2]){
                  redis.lrange('sockets:'+data.targetId,0,-1,function(err, socs){
                    if(socs){
                      socs.forEach(function(soc){
                        try{

                          io.of('/hiin').sockets[soc].emit('message' , ms);

                        }catch(err){
                          redis.lrem('sockets:'+data.targetId,-1,soc,function(err,re){
                            console.log('dumy sockets remove:'+soc);
                          });
                        }
                      });
                    }else{
                      //no socket exist in target
                      console.log('target:'+data.targetId+' has no socket');
                    }

                  });
                  if(targetInfo[0]=='ios'){

                    var apnConnection = new apn.Connection(options);
                    apnConnection.on('error', function(err) {
                      return console.log("[apn-connection] error: " + err);
                    });

                    apnConnection.on('transmitted', function() {
                      return console.log('[apn-connection] transmitted');
                    });

                    apnConnection.on('timeout', function() {
                      return console.log('[apn-connection] timeout');
                    });

                    apnConnection.on('connected', function() {
                      return console.log('[apn-connection] connected');
                    });

                    apnConnection.on('disconnected', function() {
                      return console.log('[apn-connection] disconnected');
                    });

                    apnConnection.on('socketError', function(err) {
                      return console.log("[apn-connection] socketError: " + err);
                    });

                    apnConnection.on('transmissionError', function(err) {
                      return console.log("[apn-connection] transmissionError: " + err);
                    });

                    apnConnection.on('cacheTooSmall', function() {
                      return console.log('[apn-connection] cacheTooSmall');
                    });
                    var myDevice = new apn.Device(targetInfo[1]);
                    var note = new apn.Notification();
                    var pack = { 'type':'personal',
                      'id': userId};

                      note.alert = user.firstName + ' : ' + data.message;
                      note.sound = "default.aiff";

                      note.payload = {'message': pack};
                      console.log(userId);
                      console.log(user.enteredEvent);
                      Message.count({
                        $and:[
                          {sender: { $ne: data.targetId }},
                          {reciever:data.targetId},
                          {eventCode:user.enteredEvent},
                            {$or:[{type:'personal'},{type:'notice'}]},
                            {read:false}
                        ]
                      },function(err,cnt){
                        note.badge = cnt;
                        console.log('per chat db----');
                        console.log(cnt);
                        console.log('badge:'+note.badge);
                        apnConnection.pushNotification(note, myDevice);
                      });
                  }else if(targetInfo[0]=='android'){
                    // create a message with default values
                    //var message = new gcm.Message();
                    console.log('device key android:'+targetInfo[1]);

                    // or with object values
                    var message = new gcm.Message({
                      data: {
                        message: sndMsg,
                        payload: sndMsg,
                        type: 'personal',
                        id: userId
                      }
                    });
                    var server_access_key = 'AIzaSyClYplgFN-Qx-xW1zNAYqMP1XL78JF9JzI';
                    var sender = new gcm.Sender(server_access_key);
                    var registrationIds = [];
                    var registration_id = targetInfo[1];
                    // At least one required
                    registrationIds.push(registration_id);

                    /**
                     * Params: message-literal, registrationIds-array, No. of retries, callback-function
                     **/
                    Message.count({
                        $and:[
                        {sender: { $ne: data.targetId }},
                        {reciever:data.targetId},
                        {eventCode:user.enteredEvent},
                        {$or:[{type:'personal'},{type:'notice'}]},
                        {read:false}
                        ]
                        },function(err,cnt){
                        message.addData('badge',cnt);
                        console.log('per chat db----');
                        console.log(cnt);
                        console.log('badge:'+cnt);
                        sender.send(message, registrationIds, 4, function (err, result) {
                          console.log('----------android push--------------re');
                          console.log(result);
                          });
                        });
                  }

                }else{
                  console.log(data.targetId+'different event entered no push and msg');

                }

              }
          });
          });
        });


      });
      //notification of event owner for event attendants
      socket.on('allNotice', function(data){
        redis.hget("user:"+userId,"enteredEvent",function(err, reply){
                console.log('code:'+reply);
                Message.find({
                  $and:[
                    {reciever:userId},
                    {eventCode:reply},
                    {type:'notice'},
                  ]
                })
                .sort({created_at:1})
                .exec(function(err,msgs){
                  console.log('--------mgs------');
                  console.log(msgs);

                  var sdata = { targetId : userId , 
                    messageTpye : 'allNotice',
                           message : msgs
                         }
                    io.of('/hiin').sockets.emitPass(sdata);
                    msgs.forEach(function(msg){
                        msg.read = true;
                        msg.save(function(err){
                          console.log('read');
                        });
                      });
                  });
        });
      });
      //notification of event owner for event attendants
      socket.on('notice', function(data){
        redis.hgetall("user:"+userId,function(err, user){
          redis.smembers('attendants:'+user.enteredEvent,function(err,members){
            members.forEach(function(member){
              redis.hmget('user:'+member,'device','deviceToken','enteredEvent',function(err, targetInfo){
                var msg = new Message({
                  sender: userId,
                  reciever: member,
                  content: data.message,
                  type:'notice',
                  eventCode: user.enteredEvent,
                  created_at: new Date()
                });
                var sndMsg = user.firstName + ' : ' + data.message;
                msg.save(function(err,ms){
                  if(err)
                    console.log('err to  write msg in db');
                  else{
                    console.log('success to write msg in db');

                    if( user.enteredEvent == targetInfo[2]){

                      redis.lrange('sockets:'+member,0,-1,function(err, socs){
                        if(socs){
                          socs.forEach(function(soc){
                            try{
                              io.of('/hiin').sockets[soc].emit('notice' , {'status' : '0',
                                                               'content' : data.message,
                                                               'from' : userId,
                                                               'fromName' : user.firstName,
                                                               'thumbnailUrl' : user.thumbnailUrl,
                                                               '_id': user._id,
                                                               'regTime': new Date(),
                                                               'eventCode': user.enteredEvent,
                                                               'msgId':ms._id
                              });

                            }catch(err){
                              redis.lrem('sockets:'+member,-1,soc,function(err,re){
                                console.log('dumy sockets remove:'+soc);
                              });
                            }
                          });
                        }else{
                          //no socket exist in target
                          console.log('target:'+member+' has no socket');
                        }
                      });
                      if(targetInfo[0]=='ios'){

                        var apnConnection = new apn.Connection(options);
                        apnConnection.on('error', function(err) {
                          return console.log("[apn-connection] error: " + err);
                        });

                        apnConnection.on('transmitted', function() {
                          return console.log('[apn-connection] transmitted');
                        });

                        apnConnection.on('timeout', function() {
                          return console.log('[apn-connection] timeout');
                        });

                        apnConnection.on('connected', function() {
                          return console.log('[apn-connection] connected');
                        });

                        apnConnection.on('disconnected', function() {
                          return console.log('[apn-connection] disconnected');
                        });

                        apnConnection.on('socketError', function(err) {
                          return console.log("[apn-connection] socketError: " + err);
                        });

                        apnConnection.on('transmissionError', function(err) {
                          return console.log("[apn-connection] transmissionError: " + err);
                        });

                        apnConnection.on('cacheTooSmall', function() {
                          return console.log('[apn-connection] cacheTooSmall');
                        });
                        var myDevice = new apn.Device(targetInfo[1]);
                        var note = new apn.Notification();
                        note.alert = sndMsg;
                        var pack = { 'type':'notice',
                          'code': user.enteredEvent};
                          note.payload = {'message': pack };
                          Message.count({
                            $and:[
                              {sender: { $ne: member }},
                            {reciever:member},
                            {eventCode:user.enteredEvent},
                            {$or:[{type:'personal'},{type:'notice'}]},
                            {read:false}
                          ]
                        },function(err,cnt){
                          note.badge = cnt;
                          apnConnection.pushNotification(note, myDevice);
                        });


                        //apnConnection.pushNotification(note, myDevice);
                      }else if(targetInfo[0]=='android'){
                        // create a message with default values
                        //var message = new gcm.Message();
                        console.log('device key android:'+targetInfo[1]);

                        // or with object values
                        var message = new gcm.Message({
                          data: {
                            message: sndMsg,
                            payload: sndMsg,
                            type: 'notice',
                            code: user.enteredEvent
                          }
                        });
                        var server_access_key = 'AIzaSyClYplgFN-Qx-xW1zNAYqMP1XL78JF9JzI';
                        var sender = new gcm.Sender(server_access_key);
                        var registrationIds = [];
                        var registration_id = targetInfo[1];
                        // At least one required
                        registrationIds.push(registration_id);

                        /**
                         * Params: message-literal, registrationIds-array, No. of retries, callback-function
                         **/
                        Message.count({
                          $and:[
                            {sender: { $ne: member }},
                            {reciever:member},
                            {eventCode:user.enteredEvent},
                            {$or:[{type:'personal'},{type:'notice'}]},
                            {read:false}
                          ]
                        },function(err,cnt){
                          message.addData('badge',cnt);
                          console.log('per chat db----');
                          console.log(cnt);
                          console.log('badge:'+cnt);
                          sender.send(message, registrationIds, 4, function (err, result) {
                            console.log('----------android push--------------re');
                            console.log(result);
                          });
                            });

                      }
                    }else{
                      console.log(data.targetId+'different event entered no push and msg');
                    }


                  }
                });
              });
            });//here for Each
          });
        });
      });

      //unread count for notice
      socket.on('unReadCountNotice', function(){
        redis.hget("user:"+userId,"enteredEvent",function(err, reply){
          Message.count({
            $and:[
              {sender: { $ne: userId }},
              {reciever:userId},
              {eventCode:reply},
              {type:'notice'},
              {read:false}
            ]
          },function(err,cnt){
            //emit unread count
            console.log('total unread notice cnt:'+cnt);
            var ob = {
              count : cnt
            }
            var sdata = { targetId : userId , 
              messageTpye : 'unReadCountNotice',
              message : ob 
            }
            console.log('unReadCountNotice');
            io.of('/hiin').sockets.emitPass(sdata);

          });
        });
      });

      //unread count for list
      socket.on('unReadCount', function(){
        redis.hget("user:"+userId,"enteredEvent",function(err, reply){
          Message.count({
            $and:[
              {reciever:userId},
              {eventCode:reply},
              {type:'personal'},
              {read:false}
            ]
          },function(err,cnt){
            //emit unread count
            console.log('total unread cnt:'+cnt);
            var ob = {
              count : cnt
            }
            var sdata = { targetId : userId , 
              messageTpye : 'unReadCount',
              message : ob 
            }
            console.log('unReadCount');
            io.of('/hiin').sockets.emitPass(sdata);

          });

        });
      });

      //unread count group for list
      socket.on('unReadCountGroup', function(){
        redis.hget("user:"+userId,"enteredEvent",function(err, reply){
          Message.count({
            $and:[
              {sender: { $ne: userId }},
              {reciever:userId},
              {eventCode:reply},
              {type:'group'},
              {read:false}
            ]
          },function(err,cnt){
            //emit unread count
            console.log('total unread group cnt:'+cnt);
            var ob = {
              count : cnt
            }
            var sdata = { targetId : userId , 
              messageTpye : 'unReadCountGroup',
              message : ob
            }
            io.of('/hiin').sockets.emitPass(sdata);

          });

        });
      });

      //disconnection, remove all user socket in redis
      socket.on('disconnect', function(){

        redis.hset('user:'+userId,'status','sleep',function(err,re){
          console.log('socketDisconnection:'+userId);
        });
      });

     
    });

 
    io.of('/hiin').sockets.emitTo = function(data){
      redis.lrange('sockets:'+data.targetId,0,-1,function(err, socs){
        if(socs){
            socs.forEach(function(soc){
              try{

                io.of('/hiin').sockets[soc].emit(data.messageTpye , {'status' : '0',
                                                 'message' : data.message
                });
              }catch(err){
                redis.lrem('sockets:'+data.targetId,-1,soc,function(err,re){
                  console.log('dumy sockets remove:'+soc);
                });
              }
            });
        }pa
      });
    };

    io.sockets.sockets.emitTo = function(data){
      redis.lrange('sockets:'+data.targetId,0,-1,function(err, socs){
        if(socs){
            socs.forEach(function(soc){

              try{
                io.of('/hiin').sockets[soc].emit(data.messageTpye , {'status' : '0',
                                                 'message' : data.message
                });
              }catch(err){
                redis.lrem('sockets:'+data.targetId,-1,soc,function(err,re){
                  console.log('dumy sockets remove:'+soc);
                });
              }
            });
        }
      });
    };

    io.of('/hiin').sockets.emitPass = function(data){
      redis.lrange('sockets:'+data.targetId,0,-1,function(err, socs){
        if(socs){
            socs.forEach(function(soc){
              try{
                io.of('/hiin').sockets[soc].emit(data.messageTpye , data.message);
              }catch(err){
                redis.lrem('sockets:'+data.targetId,-1,soc,function(err,re){
                  console.log('dumy sockets remove:'+soc);
                });
              }
            });
        }
      });
    };

}






