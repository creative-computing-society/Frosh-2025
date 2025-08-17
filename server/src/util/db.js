// db.js
require('dotenv').config();
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Peoples = require('../models/peoples');
const Hoods = require('../models/hoods.model');
const User = require('../models/users.model');

const generateTokens = (userId, role) => {
    const accessToken = jwt.sign(
        { userId, role },
        process.env.SECRET,
        { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
        { userId },
        process.env.SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

let isConnected = false;

const passwordSet = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";
function makePassword() {
    let output = "";
    for (let i = 0; i < 8; i++) {
        output += passwordSet[Math.floor(Math.random() * passwordSet.length)]
    }
    return output;
}

const connectDB = async () => {
    if (isConnected) {
        console.log("MongoDB already connected.");
        return;
    }

    try {
        const conn = await mongoose.connect(process.env.DB_URL, {
            maxPoolSize: 50, // limit concurrent DB connections
            serverSelectionTimeoutMS: 15000,
        });

        await mergePeopleWithUsers();
        process.exit(0);

        isConnected = true;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;


async function fixFuckedResponses() {
    throw new Error('JOB DONE');
    const fucked_responses = await Peoples.find({ "Application Number": null });
    await Peoples.deleteMany({ "Application Number": null });
    const not_fucked_responses = []
    for (let fucked of fucked_responses) {
        fucked = fucked.toObject();
        let appNumber = fucked["Enter your Admission number"];
        if (typeof appNumber == 'string') {
            appNumber = parseInt(appNumber.slice(appNumber.length - 6, appNumber.length));
        }

        not_fucked_responses.push({
            "Name": fucked["Enter your Full Name"].trim(),
            "Application Number": appNumber,
            "Email": fucked["Enter you email id "].trim(),
            "Password": makePassword(),
        });
    }

    await Peoples.insertMany(not_fucked_responses);
}

async function createHoods() {
    throw new Error('JOB DONE');
    const hoods = [
        "The Shadowveil Sentinels",
        "The Crimson Revenants",
        "The Eternal Vanguards",
        "The Unbound Ravagers"
    ];
    for (const hood of hoods) {
        await Hoods.insertOne({
            Name: hood,
            NumberOfStudents: 0,
            Points: 0,
        });
    }
}

async function dedupePeople() {
    throw new Error('JOB DONE');
    const duplicates = await Peoples.aggregate([
        {
            $group: {
              _id: "$Application Number",
              ids: { $push: "$_id" },
              count: { $sum: 1 }
            }
          },
          { $match: { count: { $gt: 1 } } }
    ]);
    const total_ids = []
    for (const duplicate of duplicates) {
        const ids = duplicate.ids.slice(1);
        total_ids.push(...ids);
    }
    await Peoples.deleteMany({
        _id: { "$in": total_ids }
    });
}

async function mergePeopleWithUsers() {
    // const people = await Peoples.find({});
    const emailsInUser = await User.find().distinct("email");

    const people = await Peoples.find({
        Email: { $nin: emailsInUser }
    });
    const users = [];
    for (const person of people) {
        console.log(person.Name);
        const _id = new mongoose.Types.ObjectId();
        const { accessToken, refreshToken } = generateTokens(_id, "user");
        users.push({
            _id,
            name: person.Name,
            email: person.Email,
            password: await hashThisShit(person.Password),
            accessToken,
            refreshToken,
        });
        await User.insertOne(users[0]);
        break;
    }
    console.log(users);
    // await User.insertMany(users);
}

async function hashThisShit(password) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}