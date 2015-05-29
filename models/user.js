// load the things we need
var mongoose = require('mongoose');


// define the schema for our user model
var userSchema = mongoose.Schema({

        email : {type: String, unique: true },
        password : {type: String },
        firstName : {type: String, required: true },
        lastName : {type: String, required: true },
        token : {type: String, unique: true },
        socketId : String,
        status : String,
        loginstatus : String,
        gender : {type: String, required: true },
        birth : Date,
        job : String,
        photoUrl : String,
        thumbnailUrl : String,
        loginType : String,
        acceptHi : Array,
        requestHi : Array,
        pendingHi : Array,
        regTime: Date,
        organizer: String,
        device: String,
        deviceToken: String

});
// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);

