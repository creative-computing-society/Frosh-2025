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

module.exports = { logger, requestLogger, statusCodeLogger };
