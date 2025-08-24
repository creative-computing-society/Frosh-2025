const mongoose = require("mongoose");

const passSchema = new mongoose.Schema({
	// PassUUID used in controllers but not defined in model	
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	eventId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Event",
		required: true,
	},
	passStatus: {	
		type: String,
		enum: ["active", "expired", "pending", "confirmed"],
		default: "active",
	},
	isScanned: {
		type: Boolean,
		default: false,
	},
	isInside: {
		type: Boolean,
		default: false,
	},
	timeScanned: {
		type: Date,
		default: null,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	});

passSchema.index(
	{ userId: 1, eventId: 1, passStatus: 1 },
	{ unique: true }
	);

const Pass = mongoose.model("Pass", passSchema);
module.exports = Pass;
