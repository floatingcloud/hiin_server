// load the things we need
var mongoose = require('mongoose');

// define the schema for our user model
var eventSchema = mongoose.Schema({

        code : {type: String, unique: true, required: true },
        name : String,
        startDate : Date,
        endDate : Date,
        lon : Number,
        lat : Number,
        desc : String,
        place : String,
        authorName : String,
        author : String,
        attendants :[],
        regTime : Date

});

// create the model for users and expose it to our app
module.exports = mongoose.model('Event', eventSchema);

