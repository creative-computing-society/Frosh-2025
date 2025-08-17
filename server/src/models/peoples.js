const mongoose = require("mongoose");

const peopleSchema = new mongoose.Schema({
	Name: {
		type: String,
	},
	"Application Number": {
		type: Number
	},
	Email: {
		type: String,
	},
	Password: {
		type: String,
	}
});

const Peoples = mongoose.model("Peoples", peopleSchema, "Peoples");
module.exports = Peoples;
