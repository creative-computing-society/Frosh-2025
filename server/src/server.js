

require('dotenv').config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const logger = require("./util/logger");
const PORT = process.env.PORT;


// Instantiate an Express Application
const app = express();

// Configure Express App Instance
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));




// Configure custom logger middleware
app.use(logger.dev, logger.combined);

app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


// This middleware adds the json header to every response
app.use("*", (req, res, next) => {
	res.setHeader("Content-Type", "application/json");
	next();
});



app.use("/", require("./routes/router"));

// Handle errors with standard Express error handler
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ 
		status: false, 
		message: "Something went wrong!",
		error: process.env.NODE_ENV === 'development' ? err.message : undefined
	});
});

// Handle not valid route
app.use("*", (req, res) => {
	res.status(404).json({ status: false, message: "Endpoint Not Found" });
});

const mongoose = require("mongoose");

const DB_URL = process.env.DB_URL;
console.log(DB_URL)
// const DB_URL = "mongodb://localhost:27017";
const connectDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.DB_URL, {
			serverSelectionTimeoutMS: 15000, // Increase timeout to 15 seconds
		});
		console.log(`MongoDB Connected: ${conn.connection.host}`);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}
};
connectDB();

// Open Server on selected Port
app.listen(PORT, () => console.info("Server listening on port ", PORT));