/*
 * user login Routes
 */

var User = require('../models/user');
var Event = require('../models/event');
var uuid = require('node-uuid');
var https = require('https');
var util = require('util');
var formidable = require('formidable');
var crypto = require('crypto');
var easyimg = require('easyimage');
var uuid = require('node-uuid');


module.exports = function(app, redis, sockets) {
  //facebook login by graph api
  app.post('/loginWithFacebook', function(req, res) {
    console.log('---facebook login----');
    console.log(req.body);
    console.log('---------------------');
    var accessToken, buffer;
    accessToken = req.body.accessToken;
    if (accessToken == null) {
      res.send({
        error: "access_token needed"
      }, 400);
    }
    buffer = new Buffer(0);
    var fb,uid,firstName,lastName,thumbnailUrl,email,gender,photoUrl,work,job;
    console.log('tag1');
    https.get("https://graph.facebook.com/me?access_token=" + accessToken+'&fields=id,first_name,last_name,email,gender,work,picture.type(large)', function(res_) {
      console.log('tag2');
      res_.on('data', function(d) {
        console.log('tag3');
        console.log(d);
        fb=JSON.parse(d);
        console.log(fb);
      });
      res_.on('end', function() {
        console.log('tag4');
        uid = fb["id"];
        first_name = fb["first_name"];
        last_name = fb["last_name"];
        email = fb["email"];
        work = fb["work"];
        //work.forEach(function(ele,idx){
          //console.log(ele);
        //});
        //if (work){
          //if(work[0].employer){
            //if(work[0].position){
              //job = work[0].employer.name+"/"+work[0].position.name;
            //}else{
              //job = work[0].employer.name;
            //}
          //}
        //}else{
          //job = "closed";
        //}
        job = "closed";
        if (fb["gender"] == 'male'){
          gender = 2;
        }else{
          gender = 1;
        }
        photoUrl = fb["picture"].data.url;
        if (uid == null) {
          res.send({
            error: "Can't find uid from access_token"
          }, 500);
        }else{
          https.get("https://graph.facebook.com/"+uid+"/picture?redirect=0&height=100&type=normal&width=100" , function(res_){
            res_.on('data', function(d) {
              json = JSON.parse(d);
              dt = json["data"];
              thumbnailUrl = dt.url;

              var mtoken = uuid.v1({
                node: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab],
                clockseq: 0x1234,
                msecs: new Date().getTime(),
                nsecs: 5678
              });

              var userDoc = {
                email : email,
                firstName : first_name,
                lastName : last_name,
                token : mtoken,
                gender : gender,
                job : job,
                photoUrl : photoUrl,
                thumbnailUrl : thumbnailUrl,
                loginType : "facebook",
                organizer: "user",
                acceptHi : [],
                requestHi : [],
                pendingHi : [],
                device : req.body.device,
                deviceToken : req.body.deviceToken
              };
              User.findOne({email: userDoc.email}, function(err,user){
                console.log('tag6');

                if(user){
                  //user.lastName = userDoc.lastName;
                  user.token = userDoc.token;
                  //user.gender = userDoc.gender;
                  //user.job = userDoc.job;
                  //user.photoUrl = userDoc.photoUrl;
                  //user.thumbnailUrl = userDoc.thumbnailUrl;
                  user.device = userDoc.device;
                  user.deviceToken = userDoc.deviceToken;

                  user.save(function(err){
                    var ukey = "user:"+user._id;
                    redis.hset(ukey,"device",user.device,function(err,re){
                      redis.hset(ukey,"deviceToken",user.deviceToken,function(err,re){
                        redis.hset(ukey,"_id",user._id,function(err,re){
                          redis.hset(ukey,"firstName",user.firstName,function(err,re){
                            redis.hset(ukey,"lastName",user.lastName,function(err,re){
                              redis.hset(ukey,"gender",user.gender,function(err,re){
                                redis.hset(ukey,"loginType",user.loginType,function(err,re){
                                  redis.hset(ukey,"job",user.job,function(err,re){
                                    redis.hset(ukey,"photoUrl",user.photoUrl,function(err,re){
                                      redis.hset(ukey,"thumbnailUrl",user.thumbnailUrl,function(err,re){
                                        redis.hset(ukey,"organizer",user.organizer,function(err,re){
                                          redis.hset(ukey,"email",user.email,function(err,result){
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
                      });
                    });
                  });

                }else{
                  console.log('tag8');
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
                                  redis.hset(ukey,"loginType",user.loginType,function(err,re){
                                    redis.hset(ukey,"job",user.job,function(err,re){
                                      redis.hset(ukey,"photoUrl",user.photoUrl,function(err,re){
                                        redis.hset(ukey,"thumbnailUrl",user.thumbnailUrl,function(err,re){
                                          redis.hset(ukey,"organizer",user.organizer,function(err,re){
                                            redis.hset(ukey,"email",user.email,function(err,result){
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
                        });
                      });
                    }

                  });

                }

              });

            });
          });

        }
      });
    });


  });


  app.post('/login', function(req, res) {


          User.findOne({email: req.body.email}, function(err,user){

                   if(err){
                     console.log("err:db fetch fail")
                     res.send({"status":"-3"}); // db fetch fail 
                     return next(err);
                   }
                   if(user){
                     if(validPassword(req.body.password,user.password)){


                       var token = uuid.v1({
                         node: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab],
                         clockseq: 0x1234,
                         msecs: new Date().getTime(),
                         nsecs: 5678
                       });

                       req.session.userId = user._id;
                       user.token =token;
                       user.loginstatus = true;
                       req.session.user = user;

                       //user profile load redis in login time in hash
                       var ukey = "user:"+user._id;
                       redis.hset(ukey,"device",req.body.device,function(err,re){
                         redis.hset(ukey,"deviceToken",req.body.deviceToken,function(err,re){
                           redis.hset(ukey,"_id",user._id,function(err,re){
                             redis.hset(ukey,"email",user.email,function(err,re){
                               redis.hset(ukey,"firstName",user.firstName,function(err,re){
                                 redis.hset(ukey,"lastName",user.lastName,function(err,re){
                                   redis.hset(ukey,"gender",user.gender,function(err,re){
                                     redis.hset(ukey,"loginType",user.loginType,function(err,re){
                                       redis.hset(ukey,"birth",user.birth,function(err,re){
                                         redis.hset(ukey,"job",user.job,function(err,re){
                                           redis.hset(ukey,"photoUrl",user.photoUrl,function(err,re){
                                             redis.hset(ukey,"thumbnailUrl",user.thumbnailUrl,function(err,re){
                                               redis.hset(ukey,"organizer",user.organizer,function(err,re){
                                                 redis.hset('token',user.token,user._id,function(err,re){
                                                   var data = { "status" : "0",
                                                     "Token": token};
                                                     res.send(data);
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
                       res.send( {"status":"-1"}); // wrong password
                     }
                  }else{
                    res.send( {"status":"-2"}); // not existing email
                  }
          });
 });

  // quit session log out
  app.get('/logout', function(req, res, next) {
    redis.hdel('token',req.session.userId,function(e,r){
      redis.hdel("user:"+req.session.userId,["enteredEvent","_id","email","firstName","lastName","gender","birth","job","photoUrl","thumbnailUrl","organizer"],function(e,r){
        console.log('--log out user');
        delete req.session;

      });

    });
   
    res.send( { "status" : "0" }); //success log out
  });

};



