const winston = require("winston");
const expressWinston = require("express-winston");

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const color = level === 'error' ? '\x1b[31m' : '\x1b[32m';
            const reset = '\x1b[0m';
            return `${color}[${timestamp}] ${level.toUpperCase()}: ${message} ${reset} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/combined.log',
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.prettyPrint()
            )
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.prettyPrint()
            )
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
});

// Create a separate logger for console statements with all log levels
const consoleLogger = winston.createLogger({
    level: 'debug', // Set to debug to capture all levels
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ level, timestamp, message }) => {
            return `[${timestamp}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/terminal.log',
            level: 'debug' // Capture all levels including debug
        })
    ],
});

// Override console.log to capture and log to terminal.log
const originalConsoleLog = console.log;
console.log = (...args) => {
    // Convert arguments to a single string message
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Log to terminal.log file
    consoleLogger.info(message);
    
    // Still call the original console.log for terminal output
    originalConsoleLog.apply(console, args);
};

// Capture all console methods and redirect to terminal.log
const originalConsoleError = console.error;
console.error = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    consoleLogger.error(`ERROR: ${message}`);
    originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    consoleLogger.warn(`WARN: ${message}`);
    originalConsoleWarn.apply(console, args);
};

const originalConsoleInfo = console.info;
console.info = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    consoleLogger.info(`INFO: ${message}`);
    originalConsoleInfo.apply(console, args);
};

const originalConsoleDebug = console.debug;
console.debug = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    consoleLogger.debug(`DEBUG: ${message}`);
    originalConsoleDebug.apply(console, args);
};

const originalConsoleTrace = console.trace;
console.trace = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    consoleLogger.info(`TRACE: ${message}`);
    originalConsoleTrace.apply(console, args);
};

const originalConsoleAssert = console.assert;
console.assert = (assertion, ...args) => {
    if (!assertion) {
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        consoleLogger.error(`ASSERT: ${message}`);
    }
    originalConsoleAssert.apply(console, [assertion, ...args]);
};

// Handle console.dir specifically for object inspection
const originalConsoleDir = console.dir;
console.dir = (obj, options = {}) => {
    const message = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
    consoleLogger.info(`DIR: ${message}`);
    originalConsoleDir.apply(console, [obj, options]);
};

// Handle console.table for tabular data
const originalConsoleTable = console.table;
console.table = (tabularData, properties) => {
    const message = typeof tabularData === 'object' ? JSON.stringify(tabularData, null, 2) : String(tabularData);
    consoleLogger.info(`TABLE: ${message}`);
    originalConsoleTable.apply(console, [tabularData, properties]);
};

const requestLogger = expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}}",
    requestWhitelist: ['body', 'query', 'params'],
    responseWhitelist: ['statusCode'],
});

// Custom middleware to log 4xx and 5xx responses
const statusCodeLogger = (req, res, next) => {
    const oldSend = res.send;
    res.send = function (data) {
        if (res.statusCode >= 400) {
            logger.error(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode}`, {
                body: req.body,
                query: req.query,
                params: req.params
            });
        }
        return oldSend.apply(res, arguments);
    };
    next();
};

module.exports = { logger, requestLogger, statusCodeLogger, consoleLogger };