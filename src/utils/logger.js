const winston = require('winston');
require('winston-daily-rotate-file'); // Import winston-daily-rotate-file

// Function to create a rotating file transport with symlink
const createRotateTransport = (level, filename, symlinkName) => {
    return new winston.transports.DailyRotateFile({
        filename: `logs/${filename}-%DATE%.log`, // Log files pattern
        datePattern: 'YYYY-MM-DD', // Daily rotation
        maxSize: '10m', // Rotate when file size exceeds 10MB
        maxFiles: '10d', // Keep logs for 10 days
        zippedArchive: true, // Compress old logs
        symlinkName: `logs/${symlinkName}`, // Create a symlink to the latest file
        level: level // Log level (info, error, warn)
    });
};

// Check if running in AWS Lambda
const isLambda = !!process.env.LAMBDA_TASK_ROOT;

// Define transports based on environment
const transports = [
    new winston.transports.Console() // Always log to console in Lambda and local environments
];

if (!isLambda) {
    // Add file transports only if not running in Lambda
    transports.push(
        createRotateTransport('info', 'app', 'current.log'),
        createRotateTransport('error', 'errors', 'current.error.log'),
        createRotateTransport('warn', 'warnings', 'current.warning.log')
    );
}

// Create Winston logger
const logger = winston.createLogger({
    level: 'info', // Default log level
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports
});

module.exports = logger;