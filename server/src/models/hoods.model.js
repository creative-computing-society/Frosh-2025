const mongoose = require("mongoose");

const hoodsSchema = new mongoose.Schema({
    Name: {
        type: String,
    },
    NumberOfStudents: {
        type: Number
    },
    Points: {
        type: Number
    },
    Color: {
        type: String,
    }
});


const Hoods = mongoose.model("Hoods", hoodsSchema);
module.exports = Hoods;
