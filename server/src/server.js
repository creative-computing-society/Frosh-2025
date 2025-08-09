// server.js
require('dotenv').config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const logger = require("./util/logger");
const connectDB = require("./util/db");

const PORT = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use([logger.dev, logger.combined]);
app.use(cookieParser());

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Always set JSON content type
app.use("*", (req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    next();
});

// Routes
app.use("/", require("./routes/router"));

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: false,
        message: "Something went wrong!",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ status: false, message: "Endpoint Not Found" });
});

// Start server after DB connection
connectDB().then(() => {
    app.listen(PORT, () => console.info(`🚀 Server running on port ${PORT}`));
});
