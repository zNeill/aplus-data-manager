const axios = require('axios');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryptCredentials');
require('dotenv').config();
const Queue = require('bull');

// Load and decrypt Certain API credentials
const CERTAIN_API_USERNAME = decrypt(process.env.CERTAIN_API_USERNAME_ENCRYPTED);
const CERTAIN_API_PASSWORD = decrypt(process.env.CERTAIN_API_PASSWORD_ENCRYPTED);

// Create a Bull queue using the Redis endpoint
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const certainApiQueue = new Queue('certainApiQueue', redisUrl);

// Listen for queue errors
certainApiQueue.on('error', (err) => {
    logger.error(`❌ Queue error: ${err.message}`);
});

// Listen for job failures
certainApiQueue.on('failed', (job, err) => {
    logger.error(`❌ Job failed: ${err.message}`);
});

// Process jobs with a concurrency of 20
certainApiQueue.process(20, async (job) => {
    const { apiUrl, params } = job.data;
    logger.info(`ℹ️ Processing API request: ${apiUrl} with params ${JSON.stringify(params)}`);

    let attempt = 0;
    const maxAttempts = 10; // Prevent infinite retries
    const maxWaitTime = 120000; // 2 minutes max wait
    let waitTime = 2000; // Start with a 2-second delay on 429 errors

    while (attempt < maxAttempts) {
        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${CERTAIN_API_USERNAME}:${CERTAIN_API_PASSWORD}`).toString('base64')}`
                },
                params
            });

            if (!response.data || Object.keys(response.data).length === 0) {
                logger.warn(`⚠️ Empty API response for ${apiUrl}, returning null.`);
                return null;
            }

            logger.info(`✅ API response received for ${apiUrl}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                const { status } = error.response;

                // Handle 404 (No Data Available)
                if (status === 404) {
                    logger.warn(`⚠️ 404 Not Found: ${apiUrl}. No data available.`);
                    return null;
                }

                // Handle 429 Rate Limit with exponential backoff
                if (status === 429) {
                    attempt++;
                    logger.warn(`⚠️ 🏃 Rate limit hit (429) on attempt ${attempt} for ${apiUrl}. Retrying in ${waitTime / 1000}s...`);

                    if (waitTime >= maxWaitTime || attempt >= maxAttempts) {
                        logger.error(`❌ Max retries reached for ${apiUrl}.`);
                        return null;
                    }

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    waitTime *= 2;
                    continue;
                }

                // Do Not Retry for other 400+ errors
                if (status >= 400 && status < 500) {
                    logger.error(`❌ Non-retriable API error ${status} for ${apiUrl}: ${error.message}`);
                    return null;
                }
            }

            // Handle network or unknown errors
            logger.error(`❌ API request failed for ${apiUrl}: ${error.message}`);
            return null;
        }
    }
});

/**
 * Queue an API request and return the result.
 */
async function fetchCertainApi(object, accountCode, eventCode, identifierCode, params = {}) {
    let apiUrl = `${process.env.CERTAIN_API_BASE}/certainExternal/service/v1/${object}/${accountCode}/${eventCode}`;
    if (identifierCode) apiUrl += `/${identifierCode}`;
    apiUrl = apiUrl.replace(/\s+/g, ''); // Ensure URL has no spaces

    logger.info(`🌍⏳ Queueing API request: ${apiUrl} with params ${JSON.stringify(params)}`);

    // Add the job to the queue
    const job = await certainApiQueue.add({ apiUrl, params });

    return new Promise((resolve, reject) => {
        job.finished()
            .then(resolve)
            .catch(reject);
        setTimeout(() => reject(new Error("Job timeout exceeded!")), 120000); // Timeout at 2 minutes
    });
}

/**
 * Get current queue status.
 */
async function getQueueStatus() {
    const counts = await certainApiQueue.getJobCounts();
    const concurrencyLimit = 20; // as set in the process() call
    const estimatedWaitTimeSeconds = Math.round((counts.waiting || 0) * 0.5);
    
    const queueReport = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        delayed: counts.delayed || 0,
        concurrencyLimit,
        estimatedWaitTimeSeconds
    };
    
    logger.info(`⌛ Queue Report: ${JSON.stringify(queueReport)}`);
    return queueReport;
}

module.exports = { fetchCertainApi, getQueueStatus };