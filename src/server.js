const app = require('./app');
const logger = require('./utils/logger');

// Only start the HTTP server if NOT running in AWS Lambda
if (!process.env.LAMBDA_TASK_ROOT) {
  const PORT = process.env.PORT || 5000;
  const REDIS_URL = process.env.REDIS_URL || 'banana'
  app.listen(PORT, () => logger.info(`API Gateway running on port ${PORT} and redis is hosting from ${REDIS_URL}`));
}
