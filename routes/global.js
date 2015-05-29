var bcrypt   = require('bcrypt-nodejs');

module.exports = function(nconf, redis){
  var parse = require('express/node_modules/cookie').parse;
  var parseSC = require('express/node_modules/connect/lib/utils').parseSignedCookies;
  global.parseCookie = function(cookie){
    return parseSC((parse(cookie)),"rlaeodnjs");
  };
  global.getCode = function(cookie){
    return {
      code : code,
      message : nconf.get(code)
    };
  };

  global.respenseWithError = function(res, code){
    res.json(getCode(code), 200);
  };

  global.responseWithError = function(res, code){
    res.json(getCode(code), 400);
  };
  //islogin
  global.isLogin = function(req, res, next){

    if (req.session.loginstatus) {
       next();    
    } else {
      res.send('not login');
    }
  };
  //not logged in - check 
  global.notLoggedIn = function(req, res, next) {
    if(req.session.loginstatus) {
      res.send({'stauts':'-1'});
    }else {
      next();
    }
  };
  //exist entered Event
  global.not_enter_event = function(req,res,next) {
     
    redis.hget("user:"+req.session.userId,"enteredEvent",function(err, reply){
      if(reply){
          res.send({"status":"-1"});
      }else{
          next(); 
      }
    });
  };

  //not entered evnet
  global.is_entered_event = function(req,res,next) {

    redis.hget("user:"+req.session.userId,"enteredEvent",function(err, reply){
      if(reply){
          next(); 
      }else{
          res.send({"status":"-1"});
      }
    });
  };

  //token check
  global.valid_token = function(req, res, next) {
    console.log('va outer');
    console.log(req.headers.authorization);

    redis.hexists('token',req.headers.authorization,function(err,result){
       if(result === 1){
          console.log('valid_token');
          next();
       } else{
         console.log('val er');
        res.send({"status":"-1"});//token error
        return;
       }
    });

   
  };
  //check organizer
  global.isOrganizer = function(req, res, next) {
   console.log('is orga');

    redis.hget("user:"+req.session.userId,"organizer",function(err,result){
       if(result === "organizer"){
          console.log('organizer check pass');
          next();
       } else{
        res.send({"status":"-1"});//token error
        console.log('not organizer');
        return;
       }
    });

   
  };
  

  // checking user match event creater
  global.event_owner = function(req, res, next){
     redis.hget("user:"+req.session.userId,"enteredEvent",function(err, reply){
      if(err){
        res.send({"stauts":"-1"});
      }else{
         if(reply){
            redis.hget("event:"+reply,"author",function(err,au){
                if(err){
                  res.send({"stauts":"-1"});
                }else{
                  if(au === req.session.userId)
                    next();
                  else
                    res.send({"stauts":"-3"});
                }
            });
          }else{
            res.send({"status":"-1"});
          }
      }
    });

  }
  // checking user doesn't match event creater
  global.not_event_owner = function(req, res, next){
    redis.hget("user:"+req.session.userId,"enteredEvent",function(err, reply){
      if(err){
        res.send({"stauts":"-1"});
      }else{
        if(reply){
          redis.hget("event:"+reply,"author",function(err,au){
            if(err){
              res.send({"stauts":"-1"});
            }else{
              if(au === req.session.userId)
                res.send({"stauts":"-3"});
              else
                next();
            }
          });
        }else{
          res.send({"status":"-1"});
        }
      }
    });

  };


  // generating a hash
  global.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
  };

  // checking if password is valid
  global.validPassword = function(password1, password2) {
    return bcrypt.compareSync(password1, password2);
  };

  global.getRandomInt= function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // add '0' in number for same digit
  global.digitbal = function(str, max) {
    str = str.toString();
    return str.length < max ? digitbal("0" + str, max) : str;
}

};
