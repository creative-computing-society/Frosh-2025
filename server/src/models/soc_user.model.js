const mongoose = require("mongoose");

const socUserSchema = new mongoose.Schema({
    name: { type: String },
    phone: { type: Number },
    email: { type: String },
    is_inside: { type: Boolean },
});

const SocUser = mongoose.model("Soc_user", socUserSchema, "soc_users");
module.exports = SocUser;
