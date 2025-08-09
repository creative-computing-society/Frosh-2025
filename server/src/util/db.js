// db.js
require('dotenv').config();
const mongoose = require("mongoose");

let isConnected = false;

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

        isConnected = true;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
