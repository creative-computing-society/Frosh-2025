// db.js
require('dotenv').config();
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Peoples = require('../models/peoples');
const Hoods = require('../models/hoods.model');
const User = require('../models/users.model');
const Event = require('../models/events.model');

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

        if (process.env.NODE_ENV != 'production') {
            // await fixUnhashedPassword();
            // console.log(await hashThisShit('1234568'));
            // await matchPeoplePasswordWithUserPasswordHash();
            // await addUser(['68a1e0f7529c9cf380e1e67a'])
            // process.exit(0);
        }

        isConnected = true;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;

async function addUser(user_str_ids) {
    const hood_ids = [
        new mongoose.Types.ObjectId('68a181cc1168c7a1eec6fd46'),
        new mongoose.Types.ObjectId('68a181cc1168c7a1eec6fd4a'),
        new mongoose.Types.ObjectId('68a181cc1168c7a1eec6fd4c'),
        new mongoose.Types.ObjectId('68a181cd1168c7a1eec6fd4e'),
    ]
    const user_ids = user_str_ids.map(id => new mongoose.Types.ObjectId(id));
    const people = await Peoples.find({
        "_id": { "$in": user_ids }
    });
    for (const person of people) {
        console.log(person.Name);
        const _id = new mongoose.Types.ObjectId();
        const { accessToken, refreshToken } = generateTokens(_id, "user");
        await User.insertOne({
            _id,
            name: person.Name,
            email: person.Email,
            password: await hashThisShit(person.Password),
            accessToken,
            refreshToken,
            hood: hood_ids[Math.floor(Math.random() * hood_ids.length)]
        });
    }
}


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
    throw new Error('JOB DONE');
    const emailsInUser = await User.find().distinct("email");

    const people = await Peoples.find({
        Email: { $nin: emailsInUser }
    });
    for (const person of people) {
        console.log(person.Name);
        const _id = new mongoose.Types.ObjectId();
        const { accessToken, refreshToken } = generateTokens(_id, "user");
        const user = {
            _id,
            name: person.Name,
            email: person.Email,
            password: await hashThisShit(person.Password),
            accessToken,
            refreshToken,
        };
        await User.insertOne(user);
    }
}

async function assignNullRoleAsUser() {
    throw new Error('JOB DONE');
    await User.updateMany(
        { role: null },
        { $set: { role: "user" } }
    );
}

async function assignHoods() {
    throw new Error('JOB DONE');
    const users = await User.find({ role: "user", hood: null });
    console.log(users.length);
    // hood assignment
    // 746
    // 746
    // 746
    // 747
    const hood_ids = [
        new mongoose.Types.ObjectId('68a181cc1168c7a1eec6fd46'),
        new mongoose.Types.ObjectId('68a181cc1168c7a1eec6fd4a'),
        new mongoose.Types.ObjectId('68a181cc1168c7a1eec6fd4c'),
        new mongoose.Types.ObjectId('68a181cd1168c7a1eec6fd4e'),
    ]
    const hood_id_distribution = [746, 746, 746, 747];
    for (const user of users) {
        console.log(user.name);
        const hood = getRandomHood(hood_id_distribution, hood_ids);
        if (hood == false) return;
        await User.findByIdAndUpdate(user._id, {
            hood
        });
    }
}

function getRandomHood(hoods, hood_ids) {
    if (hoods.find(x => x != 0) === undefined) return false;
    let random_hood_idx;
    do {
        random_hood_idx = Math.floor(Math.random() * hoods.length);
    } while(hoods[random_hood_idx] == 0);
    hoods[random_hood_idx]--;

    return hood_ids[random_hood_idx];
}

async function hashThisShit(password) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

async function matchPeoplePasswordWithUserPasswordHash() {
    throw new Error('JOB DONE');
    const people = await Peoples.find({});
    console.log(people.length);
    for (const person of people) {
        console.log(person.Name);
        await User.updateOne({ email: person.Email }, {
            password: await hashThisShit(person.Password)
        });
    }
}

async function fixUnhashedPassword() {
    const fuckedUsers = await User.find({ password: { $not: RegExp("^\\$2b\\$") } });

    for (const fuckedUser of fuckedUsers) {
        console.log(fuckedUser.name);
        fuckedUser.password = await hashThisShit(fuckedUser.password);
        await fuckedUser.save();
    }
}