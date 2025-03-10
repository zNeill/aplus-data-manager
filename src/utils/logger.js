const winston = require("winston");
require("winston-daily-rotate-file");
require("winston-cloudwatch");


// Function to create a rotating file transport with symlink
const createRotateTransport = (level, filename, symlinkName) => {
    return new winston.transports.DailyRotateFile({
        filename: `logs/${filename}-%DATE%.log`,
        datePattern: "YYYY-MM-DD",
        maxSize: "10m",
        maxFiles: "10d",
        zippedArchive: true,
        symlinkName: `logs/${symlinkName}`,
        level: level
    });
};

// Check if running in AWS Lambda
const isLambda = !!process.env.LAMBDA_TASK_ROOT;
const isProd = process.env.IS_PROD_ENV === "true"; // Ensure this is properly set

// Define transports based on environment
const transports = [
    new winston.transports.Console() // Always log to console in all environments
];

// Add file transports if not running in AWS Lambda
if (!isLambda) {
    transports.push(
        createRotateTransport("info", "app", "current.log"),
        createRotateTransport("error", "errors", "current.error.log"),
        createRotateTransport("warn", "warnings", "current.warning.log")
    );
}

// Add CloudWatch logging in production (if enabled)
if (isProd) {
    transports.push(
        new winston.transports.CloudWatch({
            logGroupName: "aplus-data-manager-logs", // CloudWatch Log Group
            logStreamName: `aplus-data-manager-log-stream-${new Date().toISOString().split('T')[0]}`, // Daily stream
            awsOptions: {
                region: process.env.AWS_REGION || "us-east-2",
            },
            jsonMessage: true
        })
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