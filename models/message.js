// load the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectIdSchema = Schema.ObjectId;
var ObjectId = mongoose.Types.ObjectId;

// define the schema for our user model
var messageSchema = mongoose.Schema({

        _id : {type:ObjectIdSchema, default: function () { return new ObjectId()} },
        sender : String,
        sender_name: String,
        reciever : String,
        content : String,
        type : String,
        thumbnailUrl : String,
        eventCode : String,
        created_at : Date,
        read : {type: Boolean, default: false},
        status: String

});

// create the model for users and expose it to our app
module.exports = mongoose.model('Message', messageSchema);
