/*
 * User Routes
 */
var async = require('async');
var User = require('../models/user');
var path = require('path')
var fs = require('fs');
var util = require('util');
var formidable = require('formidable');
var crypto = require('crypto');
var easyimg = require('easyimage');
var uuid = require('node-uuid');

module.exports = function(app, redis) {
  // valid token api
  app.post('/isAvailableToken', function(req, res, next){
    console.log(req.body.Token);
    redis.hexists('token',req.body.Token ,function(err,result){
       if(result === 1){
          console.log('valid_token');
          console.log(req.body.Token);
          redis.hget('token',req.body.Token,function(err,uid){
            req.session.userId = uid;
            console.log('------userid-----');
            console.log(uid);
            console.log('token owner:'+req.session.userId);
            res.send({'status':'0'});
          });

         } else{
         console.log('val er');
        res.send({"status":"-1"});//token error
        return;
       }
    });

  });

  // valid event api
  app.post('/isAvailableEvent', function(req, res, next){
    redis.exists("event:"+req.body.code ,function(err,result){
       if(result === 1){
          console.log('valid_event');
          res.send({'status':'0'});
       } else{
         console.log('val er');
        res.send({"status":"-1"});//non valid event error
        return;
       }
    });

  });


  // porofile image upload in sign up process
  app.post('/profileImage', function(req, res, next) {
     
     var form = new formidable.IncomingForm(),
         files = [],
         fields = [];
     var sendData;
     var makeName = crypto.randomBytes(8).toString('hex')+"_"+(new Date).getTime();

     form.uploadDir = "public/profileImageOriginal";



     form
       .on('field', function(field, value) {
       fields.push([field, value]);
      })
       .on('file', function(field, file) {
        sendData = { photoUrl : "profileImageOriginal/" +makeName +".png",
                     thumbnailUrl : "profileImageThumbnail/"+makeName+"_thumb.png" 
                   };
        fs.rename(file.path,"public/"+sendData.photoUrl);
        files.push([field, file]);
        


       })
       .on('end', function() {

         console.log('-> upload done');
         console.log(sendData);
         easyimg.exec("convert "+ "public/"+sendData.photoUrl + " -auto-orient " + "public/"+sendData.photoUrl)
         .then(function(file){
           console.log(file);
           easyimg.rescrop({
             src:"public/"+sendData.photoUrl, dst:"public/"+sendData.thumbnailUrl,
             width:100,
             cropwidth:100, cropheight:100,
             x:0, y:0
           }).then(function(image) {
             console.log('Resized and cropped: ' + image.width + ' x ' + image.height);
             easyimg.info("public/"+sendData.photoUrl)
             .then(function(info){
               if(info.width > 720){
                 easyimg.resize({
                   src:"public/"+sendData.photoUrl, dst:"public/"+sendData.photoUrl,
                   width:720
                 }).then(function(rimage) {
                   console.log('Resized original: ' + rimage.width + ' x ' + rimage.height);
                   res.send(sendData);
                 },function(err){
                   console.log('original err');
                 });
               }else{
                 res.send(sendData);
               }
             },function(err){
               console.log('info err');
             });
           },function(err){
             console.log(err);
           });
         },function(err){
         });

       });
     form.parse(req); 

  });

    app.post('/cropImage', function(req, res, next) {
        console.log(req.body);
        var cwidth = parseFloat(req.body.width);
        var cheight = parseFloat(req.body.height)
        var cx = parseFloat(req.body.left)
        var cy = parseFloat(req.body.top)
        var wr = cwidth/100;
        var vr = cheight/100;
        var scaleWidth = parseFloat(req.body.originalWidth)/wr;
        var scaleHeight = parseFloat(req.body.originalHeight)/vr;
        var xp = cx/wr;
        var yp = cy/vr;

        
        var makeName = crypto.randomBytes(8).toString('hex')+"_"+(new Date).getTime();
        var sendData = { photoUrl: "profileImageOriginal/"+makeName+".png",
                         thumbnailUrl : "profileImageThumbnail/"+makeName+"_thumb.png"   }
        easyimg.crop({src:"public/"+req.body.url, dst:"public/profileImageOriginal/"+makeName+".png",
             cropwidth: cwidth, cropheight:cheight,
             gravity: 'NorthWest',
             x: cx, y: cy
          },function(err, image) {
               if (err) throw err;
                 console.log('cropped: ' + image.width + ' x ' + image.height);
                  easyimg.rescrop({
                  src:"public/"+req.body.url, dst:"public/profileImageThumbnail/"+makeName+"_thumb.png",
                  width: scaleWidth, height: scaleHeight,
                  cropwidth:100, cropheight:100,
                  gravity: 'NorthWest',
                  x: xp, y: yp
                  },function(err, image) {
                        if (err) throw err;

                     console.log('Resized and cropped: ' + image.width + ' x ' + image.height);
                     res.send(sendData);
                 });


          });
        
  });


  //check sign in user organizer
  app.get('/checkOrganizer', valid_token, function(req, res, next){
    console.log('checkOrganizer');
    redis.hget('token',req.headers.authorization,function(err, userId){
      var ukey = 'user:'+userId;
      console.log(ukey);
      redis.hget(ukey,'organizer',function(err, org){
        console.log('checkOrganizer:'+org);
        if(org==='user'){
          console.log('status:1');
          res.send({ 
                    'status':'1',
                    'organizer':'user'
                  });
        }else if(org==='organizer'){
          console.log('status:0');
          res.send({ 
                    'status':'0',
                    'organizer':'organizer'
                  });
        }
        else{
          console.log('status:-1');
          res.send({
                     'status':'-1'
          });
        }
      });

    });
  });

  //upgrade fb accounts to organizer
  app.get('/organizerFbSignUp', function(req, res, next){
    var userDoc = {
      organizer: "organizer"
    }
    User.update({token:req.headers.authorization},{$set:userDoc}, function(err){
      if(err){ 
        if(err.code === 11000){
          res.send({'status':'-1'});//conflict
        }else{
          res.send({'status':'-2'});//server error
        }
      }else{
        redis.hset("user:"+req.session.userId,"organizer","organizer",function(err,result){
          res.send({'status':'0'
          });
        });
      }
    });
  });


  //upgrade accounts to organizer
  app.post('/organizerSignUp', function(req, res, next){
    var userDoc = {
      email: req.body.email,
      password : generateHash(req.body.password),
      organizer: "organizer"
    }
    User.update({token:req.headers.authorization},{$set:userDoc}, function(err){
      if(err){ 
        if(err.code === 11000){
          res.send({'status':'-1'});//conflict
        }else{
          res.send({'status':'-2'});//server error
        }
      }else{
        redis.hset("user:"+req.session.userId,"email",req.body.email,function(err,result){
          redis.hset("user:"+req.session.userId,"organizer","organizer",function(err,result){
            res.send({'status':'0'
            });
          });
        });
      }
    });
  });

  // create new user
  app.post('/user', function(req, res, next) {
    //console.log(req.body);
    var mtoken = uuid.v1({
                        node: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab],
                        clockseq: 0x1234,
                        msecs: new Date().getTime(),
                        nsecs: 5678
                        });

    console.log('----post user reqbody---');

    console.log(req.body);
    console.log('-------------------------');
    

    var userDoc = {
        email : mtoken,
        //password : generateHash(req.body.password),
        firstName : req.body.firstName,
        lastName : req.body.lastName,
        token : mtoken,
        gender : req.body.gender,
        //birth : req.body.birth,
        job : req.body.job,
        photoUrl : req.body.photoUrl,
        thumbnailUrl : req.body.thumbnailUrl,
        loginType : "normal",
        organizer: "user",
        acceptHi : [],
        requestHi : [],
        pendingHi : [],
        device : req.body.device,
        deviceToken : req.body.deviceToken
     };
     console.log(userDoc);

    User.create(userDoc, function(err, user){

      if(err){
        if(err.code === 11000){
         res.send({'status':'-1'});//conflict
        }else{
          res.send({'status':'-2'});//server error
          next(err);
        }
      }else{
        var ukey = "user:"+user._id;
        redis.hset(ukey,"device",user.device,function(err,re){
          redis.hset(ukey,"deviceToken",user.deviceToken,function(err,re){
            redis.hset(ukey,"_id",user._id,function(err,re){
              redis.hset(ukey,"firstName",user.firstName,function(err,re){
                redis.hset(ukey,"lastName",user.lastName,function(err,re){
                  redis.hset(ukey,"gender",user.gender,function(err,re){
                    redis.hset(ukey,"job",user.job,function(err,re){
                      redis.hset(ukey,"photoUrl",user.photoUrl,function(err,re){
                        redis.hset(ukey,"thumbnailUrl",user.thumbnailUrl,function(err,re){
                          redis.hset(ukey,"organizer",user.organizer,function(err,re){
                            redis.hset('token',user.token,user._id,function(err,re){
                              req.session.userId = user._id;
                              user.token =mtoken;
                              user.loginstatus = true;
                              req.session.user = user;
                              console.log(req.session);
                              res.send({'status':'0',
                                       'Token':user.token
                              });//success
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
      }

    });
  });

  //check login status confirm
  app.get('/userStatus', valid_token, function(req, res, next){
    console.log('return');
    res.send({'status':'0'});
  });


  // delete user profile
  //app.get('/delUser', valid_token, function(req, res, next) {
            
                        //User.remove({_id:req.session.userId}, function(err) {
                           //if (err) { return next(err); }
                           //req.session.destroy();
                           //res.send({'status':'0'});//success
                       //}
         //);
  //});


  // update user profile
  app.post('/editUser', function(req, res, next){

                      var userDoc = new Object();
                      if(req.body.email!=='undefined')
                        userDoc["email"]=req.body.email;
                      if(req.body.firstName!=='undefined')
                        userDoc["firstName"]=req.body.firstName;
                      if(req.body.lastName!=='undefined')
                        userDoc["lastName"]=req.body.lastName;
                      if(req.body.gender!=='undefined')
                        userDoc["gender"]=req.body.gender;
                      if(req.body.job!=='undefined')
                        userDoc["job"]=req.body.job;
                      if(req.body.job!=='undefined')
                        userDoc["photoUrl"]=req.body.photoUrl;
                      if(req.body.job!=='undefined')
                        userDoc["thumbnailUrl"]=req.body.thumbnailUrl;


                      User.update({_id:req.session.userId},{$set:userDoc}, function(err){
                           if(err){ 
                             if(err.code === 11000){
                                     res.send({'status':'-1'});//conflict
                             }else{
                                    res.send({'status':'-2'});//server error
                              }
                          }else{

                            redis.hmset("user:"+req.session.userId,userDoc,function(err,re){
                              console.log(re);
                              User.findOne({_id:req.session.userId},function(err,user){
                                console.log(user);

                                if(err){
                                  res.send({'status':'-3'});//server error

                                }else{
                                  delete req.session.user;
                                  req.session.user = user;
                                  console.log(req.session.user);
                                  res.send({'status':'0'});//success
                                }

                              });
                            });
                            
                          }
                      });
               }
         );

}
