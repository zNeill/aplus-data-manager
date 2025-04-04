const { getCachedResponse, saveToCache, deleteEventCache } = require('./cacheController');
const { fetchCertainApi } = require('../utils/certainApiQueue');
const logger = require('../utils/logger');
const { EventEmitter } = require('winston-daily-rotate-file');
const { clear } = require('winston');

/**
 * Hydration of individual registrant's data
 * @param {*} eventCode 
 * @param {*} regCode 
 * @returns result message
 */
async function hydrateRegistrantCache(eventCode, regCode) {
    const accountCode = process.env.DEFAULT_ACCOUNT_CODE;

    if (!accountCode) {
        logger.error("❌ Missing ACCOUNT CODE! Check your environment variables.");
        throw new Error("Missing ACCOUNT CODE! Set DEFAULT_ACCOUNT_CODE in .env");
    }

    logger.info(`🛠️ Starting registrant cache hydration for event: ${eventCode}, reg: ${regCode}, account: ${accountCode}`);

    const requests = [
        { object: 'Registration', identifierCode: regCode, queryParams: {} },
        { object: 'Registration', identifierCode: regCode, queryParams: { includeList: 'profile_questions' } },
        { object: 'Registration', identifierCode: regCode, queryParams: { includeList: 'registration_questions' } },
        { object: 'Registration', identifierCode: regCode, queryParams: { includeList: 'travel_questions', max_results: 500 } },
        { object: 'Registration', identifierCode: null, queryParams: { registrationCode: regCode, includeList: 'registration_questions' } },
        { object: 'RegistrationAgenda', identifierCode: regCode, queryParams: {orderBy: 'startDate_asc'} },
        { object: 'Accommodation', identifierCode: regCode, queryParams: { orderBy: 'arrivalDate_asc' } }
    ];

    const results = [];

    for (const reqConfig of requests) {
        const { object, identifierCode, queryParams } = reqConfig;
        const queryParamsJSON = JSON.stringify(queryParams || {});

        try {
            // ✅ Step 1: Check if data is already cached
            const cachedResponse = await getCachedResponse(object, accountCode, eventCode, identifierCode, queryParamsJSON);

            if (cachedResponse) {
                logger.info(`🔄 Skipping hydration for ${object}, already cached.`);
                results.push({ object, status: 'skipped' });
                continue; // Skip to next iteration
            }

            // ✅ Step 2: Fetch from API
            const response = await fetchCertainApi(object, accountCode, eventCode, identifierCode, queryParams);

            // ✅ Step 3: If response is null, correctly log it as skipped
            if (!response) {
                logger.warn(`⚠️ Caching EMPTY result for eventCode=${eventCode} object=${object} identifierCode=${identifierCode} queryParams=${JSON.stringify(queryParams)}`);
                results.push({ object, status: '(cached empty result)' });
                }

            // ✅ Step 4: Save to cache and log it correctly
            await saveToCache(object, accountCode, eventCode, response, identifierCode, queryParamsJSON);
            logger.info(`✅ Cached successfully:  eventCode=${eventCode} object=${object} identifierCode=${identifierCode} queryParams=${JSON.stringify(queryParams)}`);
            results.push({ object, identifierCode, queryParams, status: 'cached' });

        } catch (error) {
            logger.error(`❌ Failed to fetch ${object}: ${error.message}`);
            results.push({ object, status: 'failed', error: error.message });
        }
    }

    return { message: 'Registrant cache hydration completed', results };
}



/**
 * Express route handler for single registrant hydration
 * @param {*} req 
 * @param {*} res 
 */
async function hydrateRegistrantCacheHandler(req, res) {
    const { eventCode, regCode } = req.params;
    
    try {
        const result = await hydrateRegistrantCache(eventCode, regCode);
        res.json(result);
    } catch (error) {
        logger.error(`❌ Registrant hydration failed: ${error.message}`);
        res.status(500).json({ message: 'Registrant cache hydration failed', error: error.message });
    }
}

/**
 * Hydrate an event's cache
 * @param {*} eventCode 
 * @returns status result
 */
async function hydrateEventCache(eventCode) {
    const accountCode = process.env.DEFAULT_ACCOUNT_CODE;

    logger.info(`🛠️ Starting parallel event-wide cache hydration for event: ${eventCode}`);

    try {
        // 🟢 Step 1: Fetch all regCodes for the event
        const registrationListResponse = await fetchCertainApi(
            'RegistrationList',
            accountCode,
            eventCode,
            null,
            { isActive: true, listFields: 'registrationCode', isTestMode: false }
        );

        if (!registrationListResponse || !registrationListResponse.registrationList) {
            throw new Error(`Failed to fetch registration list for event ${eventCode}`);
        }

        const regCodes = registrationListResponse.registrationList.map(reg => reg.registrationCode);

        if (!regCodes.length) {
            logger.info(`ℹ️ No active registrants found for event: ${eventCode}`);
            return { message: `No active registrants for event ${eventCode}` };
        }

        logger.info(`✅ Found ${regCodes.length} registrants for event ${eventCode}, starting parallel processing...`);



        // 🟢 Step 2: Process each registrant in parallel
        const hydrationResults = await Promise.allSettled(
            regCodes.map(regCode => hydrateRegistrantCache(eventCode, regCode))
        );

        // 🟢 Step 3: Format the result
        const results = hydrationResults.map((result, index) => ({
            regCode: regCodes[index],
            status: result.status === 'fulfilled' ? 'hydrated' : 'failed',
            details: result.status === 'fulfilled' ? result.value : result.reason.message
        }));

        logger.info(`✅ Completed parallel event-wide hydration for event ${eventCode}`);

        return {
            message: `✅ Parallel event-wide hydration completed for ${eventCode}`,
            total: regCodes.length,
            results
        };

    } catch (error) {
        logger.error(`❌ Event-wide cache hydration failed: ${error.message}`);
        return { message: 'Event-wide cache hydration failed', error: error.message };
    }
}

async function hydrateEventCacheHandler(req, res) {
    const { eventCode } = req.params;

    try {
        const result = await hydrateEventCache(eventCode);
        res.json(result);
    } catch (error) {
        logger.error(`❌ Event hydration failed: ${error.message}`);
        res.status(500).json({ message: 'Event hydration failed', error: error.message });
    }
}

async function resetEventCacheHandler(req, res) {
    const { eventCode } = req.params;
    try {
        const clearResult = await deleteEventCache(eventCode)
        const hydrateResult = await hydrateEventCache(eventCode);
        res.json({"eventClearResult": clearResult, "eventHydrationResult": hydrateResult});
    } catch (error) {
        logger.error(`❌ Event hydration failed: ${error.message}`);
        res.status(500).json({ message: 'Event hydration failed', error: error.message });
    }
}



//  Export "handler" functions
module.exports = { hydrateRegistrantCacheHandler, hydrateEventCacheHandler, resetEventCacheHandler };

