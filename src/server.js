const app = require('./app');
const logger = require('./utils/logger');

// Only start the HTTP server if NOT running in AWS Lambda
if (!process.env.LAMBDA_TASK_ROOT) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => logger.info(`API Gateway running on port ${PORT}`));
}
