const mongoose = require("mongoose");

const socTeamSchema = new mongoose.Schema({
    ["name of Society"]: {
        type: String
    },
    SN1: { type: String }, SP1: { type: Number }, SE1: { type: String },
    SN2: { type: String }, SP2: { type: Number }, SE2: { type: String },
    SN3: { type: String }, SP3: { type: Number }, SE3: { type: String },
    SN4: { type: String }, SP4: { type: Number }, SE4: { type: String },
    SN5: { type: String }, SP5: { type: Number }, SE5: { type: String },
    SN6: { type: String }, SP6: { type: Number }, SE6: { type: String },
    SN7: { type: String }, SP7: { type: Number }, SE7: { type: String },
    SN8: { type: String }, SP8: { type: Number }, SE8: { type: String },
});

const SocTeam = mongoose.model("Soc_teams", socTeamSchema, "soc_teams");
module.exports = SocTeam;
