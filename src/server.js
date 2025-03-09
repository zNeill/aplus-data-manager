const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => logger.info(`API Gateway running on port ${PORT}`));
