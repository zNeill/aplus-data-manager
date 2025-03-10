const serverless = require('serverless-http');
const app = require('./app');

// Export the wrapped app as the Lambda handler
module.exports.handler = serverless(app);