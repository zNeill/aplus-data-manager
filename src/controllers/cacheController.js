const pool = require('../config/db');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryptCredentials');
const { fetchCertainApi } = require('../utils/certainApiQueue.js');
require('dotenv').config();

// Load and decrypt Certain API credentials
const CERTAIN_API_USERNAME = decrypt(process.env.CERTAIN_API_USERNAME_ENCRYPTED);
const CERTAIN_API_PASSWORD = decrypt(process.env.CERTAIN_API_PASSWORD_ENCRYPTED);

/**
 * Get cached API response from PostgreSQL
 */
async function getCachedResponse(object, accountCode, eventCode, identifierCode, queryParamsJSON) {
    const CACHE_EXPIRATION_HOURS = process.env.CACHE_EXPIRATION_HOURS || 24; // Default: 24 hours

    try {
        logger.info(`🔍 Checking cache for: obj=${object}, acct=${accountCode}, event=${eventCode}, identifier=${identifierCode}, params=${queryParamsJSON}`);

        let query = `
            SELECT response FROM api_cache
            WHERE object = $1 
            AND account_code = $2 
            AND (event_code IS NOT DISTINCT FROM $3)
            AND (identifier_code IS NOT DISTINCT FROM $4)
            AND (query_params::jsonb = $5::jsonb)
            AND created_at >= NOW() - INTERVAL '${CACHE_EXPIRATION_HOURS} hours'  -- Only fetch recent cache entries
            ORDER BY created_at DESC
            LIMIT 1;
        `;

        let values = [object, accountCode, eventCode, identifierCode || null, queryParamsJSON || '{}'];

        const { rows } = await pool.query(query, values);

        if (rows.length > 0) {
            logger.info(`♻️ Cache HIT for ${object} - ${eventCode} - ${identifierCode} (Cached within ${CACHE_EXPIRATION_HOURS} hours)`);
            return rows[0].response;
        } else {
            logger.info(`⛔ Cache MISS for ${object} - ${eventCode} - ${identifierCode} (No recent entries found)`);
            return null;
        }
    } catch (error) {
        logger.error(`❌ Database error while checking cache: ${error.message}`);
        return null;
    }
}




/**
 * Save API response to cache in PostgreSQL
 */
async function saveToCache(object, accountCode, eventCode, response, identifierCode, queryParamsJSON) {
    if (!response) {
        logger.warn(`⚠️ Skipping cache write: Empty response for ${object}, event: ${eventCode}, identifier: ${identifierCode}`);
        return; // ✅ Do not attempt to insert NULL responses
    }

    logger.info(`📝 Writing to cache: object=${object}, account=${accountCode}, event=${eventCode}, identifier=${identifierCode}, params=${queryParamsJSON}`);

    let query = `
        INSERT INTO api_cache (object, account_code, event_code, identifier_code, query_params, response, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
        ON CONFLICT ON CONSTRAINT unique_api_cache 
        DO UPDATE SET response = EXCLUDED.response, created_at = NOW();
    `;

    // ✅ Ensure NULL-safe values
    let values = [object, accountCode, eventCode, identifierCode || null, queryParamsJSON || '{}', response];

    try {
        await pool.query(query, values);
        logger.info(`✅ Cache WRITE: Data inserted/updated in api_cache.`);
    } catch (error) {
        logger.error(`❌ Database error while saving to cache: ${error.message}`);
    }
}





/**
 * Handle Certain-like API Request
 * (Either from Cache or Real Certain API)
 */
async function handleApiRequest(req, res) {
    const { object, accountCode, eventCode, identifierCode } = req.params;
    const queryParams = req.query;
    const queryParamsJSON = JSON.stringify(queryParams);
    const requestId = `${object}/${accountCode}/${eventCode}/${identifierCode || 'NULL'} ${queryParamsJSON || 'NULL'}`;

    logger.info(`📡 Incoming API request for: ${requestId}`);

    try {
        // Check PostgreSQL cache first
        const cachedResponse = await getCachedResponse(object, accountCode, eventCode, identifierCode, queryParamsJSON);
        if (cachedResponse) {
            logger.info(`✅ Returning cached response for ${requestId}`);
            return res.json(cachedResponse);
        }

        // Fetch fresh data using the rate-limited queue
        const response = await fetchCertainApi(object, accountCode, eventCode, identifierCode, queryParams);

        // Save response to cache
        await saveToCache(object, accountCode, eventCode, response, identifierCode, queryParams);

        logger.info(`✅ Returning fresh data for ${requestId}`);
        res.json(response);
    } catch (error) {
        logger.error(`❌ API request failed for ${requestId}: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
}



module.exports = { handleApiRequest, saveToCache, getCachedResponse };
