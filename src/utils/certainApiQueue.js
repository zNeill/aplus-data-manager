const axios = require('axios');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryptCredentials');
require('dotenv').config();
const Queue = require('bull');
const Redis = require('ioredis');

// Load and decrypt Certain API credentials
const CERTAIN_API_USERNAME = decrypt(process.env.CERTAIN_API_USERNAME_ENCRYPTED);
const CERTAIN_API_PASSWORD = decrypt(process.env.CERTAIN_API_PASSWORD_ENCRYPTED);

// Create a Bull queue using the Redis endpoint
const redisUrl = process.env.REDIS_URL;
const redisClient = new Redis(redisUrl);
redisClient.on('error', (err) => {
    logger.error(`❌ Redis error: ${err.message}`);
});
const certainApiQueue = new Queue('certainApiQueue', { 
    redis: { client: redisClient }
});

// Ensure event listeners are added only once
if (certainApiQueue.listenerCount('error') === 0) {
    certainApiQueue.on('error', (err) => {
        logger.error(`❌ Queue error: ${err.message}`);
    });
}

if (certainApiQueue.listenerCount('failed') === 0) {
    certainApiQueue.on('failed', async (job, err) => {
        if (job.attemptsMade < job.opts.attempts) {
            logger.warn(`🔄 Job ${job.id} failed. Attempt ${job.attemptsMade}/${job.opts.attempts}.`);
        } else {
            logger.error(`❌ Job ${job.id} reached max retries and will not be retried.`);
        }
    });
}

if (certainApiQueue.listenerCount('stalled') === 0) {
    certainApiQueue.on('stalled', (job) => {
        logger.warn(`⚠️ Job ${job.id} stalled and will be retried automatically.`);
    });
}

if (certainApiQueue.listenerCount('retrying') === 0) {
    certainApiQueue.on('active', (job) => {
        if (job.attemptsMade > 0) {
            logger.info(`🔄 Retrying job ${job.id}. Attempt ${job.attemptsMade}/${job.opts.attempts}`);
        }
    });
}

// Process jobs with a concurrency of 20
certainApiQueue.process(20, async (job) => {
    const { apiUrl, params } = job.data;
    logger.info(`ℹ️ Processing API request: ${apiUrl} with params ${JSON.stringify(params)}`);

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${CERTAIN_API_USERNAME}:${CERTAIN_API_PASSWORD}`).toString('base64')}`
            },
            params
        });

        if (!response.data || Object.keys(response.data).length === 0) {
            throw new Error(`Empty API response for ${apiUrl}`);
        }

        logger.info(`✅ API response received for ${apiUrl}`);
        return response.data;
    } catch (error) {
        if (error.response) {
            const { status } = error.response;

            if (status === 404) {
                logger.warn(`⚠️ 404 Not Found: ${apiUrl}. No data available.`);
                return null;
            }

            if (status === 429) {
                logger.warn(`⚠️ 🏃 Rate limit hit (429) for ${apiUrl}. Job will be retried automatically.`);
                throw error; // Let Bull handle retrying the job
            }

            if (status >= 400 && status < 500) {
                logger.error(`❌ Non-retriable API error ${status} for ${apiUrl}: ${error.message}`);
                return null;
            }
        }

        logger.error(`❌ API request failed for ${apiUrl}: ${error.message}`);
        throw error; // Ensure the job fails so Bull can retry it
    }
});

// Queue an API request
async function fetchCertainApi(object, accountCode, eventCode, identifierCode, params = {}) {
    let apiUrl = `${process.env.CERTAIN_API_BASE}/certainExternal/service/v1/${object}/${accountCode}`;
    if (eventCode) apiUrl += `/${eventCode}`;
    if (identifierCode) apiUrl += `/${identifierCode}`;
    apiUrl = apiUrl.replace(/\s+/g, '');

    logger.info(`🌍⏳ Queueing API request: ${apiUrl} with params ${JSON.stringify(params)}`);

    const job = await certainApiQueue.add({ apiUrl, params }, {
        attempts: 10, // Let Bull retry up to 10 times
        backoff: {
            type: 'exponential',
            delay: 2000 // Initial wait time before retrying
        },
        timeout: 120000 // Job timeout at 2 minutes
    });

    return new Promise((resolve, reject) => {
        job.finished()
            .then(resolve)
            .catch(reject);
        setTimeout(() => reject(new Error("Job timeout exceeded!")), 120000);
    });
}

// Get queue status including listener count and Redis connections
async function getQueueStatus() {
    const counts = await certainApiQueue.getJobCounts();
    const concurrencyLimit = 20;
    const estimatedWaitTimeSeconds = Math.round((counts.waiting || 0) * 0.5);
    const errorListeners = certainApiQueue.listenerCount('error');
    const failedListeners = certainApiQueue.listenerCount('failed');
    
    const redisInfo = await redisClient.info('clients');
    const connectedClients = redisInfo.match(/connected_clients:(\d+)/);
    const totalConnections = connectedClients ? parseInt(connectedClients[1], 10) : 0;

    const queueReport = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        delayed: counts.delayed || 0,
        concurrencyLimit,
        estimatedWaitTimeSeconds,
        errorListeners,
        failedListeners,
        totalRedisConnections: totalConnections
    };

    logger.info(`⌛ Queue Report: ${JSON.stringify(queueReport)}`);
    return queueReport;
}

// Handle graceful shutdown
process.once('SIGTERM', async () => {
    logger.info('🔻 Shutting down, closing Redis connections...');
    await certainApiQueue.close();
    await redisClient.quit();
    process.exit(0);
});

process.once('SIGINT', async () => {
    logger.info('🔻 Interrupt received, closing Redis connections...');
    await certainApiQueue.close();
    await redisClient.quit();
    process.exit(0);
});

module.exports = { fetchCertainApi, getQueueStatus };
