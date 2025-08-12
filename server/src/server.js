require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { requestLogger, statusCodeLogger } = require("./util/logger");
const connectDB = require("./util/db")
// Create Express App
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Logging Middleware
app.use(requestLogger);
app.use(statusCodeLogger);

// Routes
app.use("/", require("./routes/router"));

// 404 Handler
app.use("*", (req, res) => {
    res.status(404).json({ status: false, message: "Endpoint Not Found" });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack); // will go to terminal.log and error.log
    res.status(500).json({
        status: false,
        message: "Something went wrong!",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
});


connectDB().then(() => {
    app.listen(process.env.PORT || 8080, () => console.info(`------------------ Server running on port ${process.env.PORT || 8080}`));
});