const axios = require('axios');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryptCredentials');

require('dotenv').config();

// Load and decrypt Certain API credentials
const CERTAIN_API_USERNAME = decrypt(process.env.CERTAIN_API_USERNAME_ENCRYPTED);
const CERTAIN_API_PASSWORD = decrypt(process.env.CERTAIN_API_PASSWORD_ENCRYPTED);

async function loadPQueue() {
    const { default: PQueue } = await import('p-queue');
    return new PQueue({ concurrency: 20 });
}

// Initialize queue dynamically
let certainApiQueue;
loadPQueue().then(queue => certainApiQueue = queue);

/**
 * Fetch data from Certain API with retries for 429 rate limits & handling 404 errors gracefully.
 */
async function fetchCertainApi(object, accountCode, eventCode, identifierCode, params = {}) {
    if (!certainApiQueue) {
        certainApiQueue = await loadPQueue();
    }

    return certainApiQueue.add(async () => {
        let apiUrl = `${process.env.CERTAIN_API_BASE}/certainExternal/service/v1/${object}/${accountCode}/${eventCode}`;
        if (identifierCode) apiUrl += `/${identifierCode}`;
        apiUrl = apiUrl.replace(/\s+/g, ''); // Ensure URL has no spaces

        logger.info(`🌍 Queueing API request: ${apiUrl} with params ${JSON.stringify(params)}`);

        let attempt = 0;
        const maxWaitTime = 120000; // 2 minutes max wait
        let waitTime = 2000; // Start with a 2-second delay on 429

        while (true) {
            try {
                const response = await axios.get(apiUrl, {
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${CERTAIN_API_USERNAME}:${CERTAIN_API_PASSWORD}`).toString('base64')}`
                    },
                    params
                });

                if (!response.data || Object.keys(response.data).length === 0) {
                    logger.warn(`⚠️ Empty API response for ${apiUrl}, returning null.`);
                    return null; //  Prevents null insertion in saveToCache
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

                    // Handle 429 Rate Limit (Retries with Exponential Backoff)
                    if (status === 429) {
                        attempt++;
                        logger.warn(`⚠️ Rate limit hit (429) on attempt ${attempt} for ${apiUrl}. Retrying in ${waitTime / 1000}s...`);

                        if (waitTime >= maxWaitTime) {
                            logger.error(`❌ Max wait time exceeded for ${apiUrl}.`);
                            return null; // ✅ Prevents infinite retry loop
                        }

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        waitTime *= 2; // Exponential backoff
                        continue;
                    }

                    // Do Not Retry for Other 400+ Errors
                    if (status >= 400 && status < 500) {
                        logger.error(`❌ Non-retriable API error ${status} for ${apiUrl}: ${error.message}`);
                        return null;
                    }
                }

                // Handle Network or Unknown Errors
                logger.error(`❌ API request failed for ${apiUrl}: ${error.message}`);
                return null;
            }
        }
    });
}

/**
 * Get current queue status
 */
function getQueueStatus() {
    if (!certainApiQueue) {
        return { error: "Queue not initialized yet" };
    }

    return {
        queueSize: certainApiQueue.size,
        ongoingRequests: certainApiQueue.pending,
        concurrencyLimit: certainApiQueue.concurrency,
        estimatedWaitTimeSeconds: Math.round(certainApiQueue.size * 2) // Assuming avg 2s per request
    };
}

module.exports = { fetchCertainApi, getQueueStatus };
