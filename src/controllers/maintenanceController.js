require('dotenv').config();
const { deleteEventCache, deleteAgedCache } = require('./cacheController');
const logger = require('../utils/logger');


async function cleanCacheByHoursHandler(req, res) { 
    const hours = req.params.hours || 168;
    try {
        const message = await deleteAgedCache(hours);
        logger.info(message);
        res.json({message: message})
    } catch (error) {
        const message = `❌ Cache cleanup failed: ${error.message}`;
        logger.error(message);
        res.status(500).json({ message: 'Cache cleanup failed', error: error.message });
    }
}

async function cleanCacheByEventHandler (req, res) {
    const eventCode = req.params.eventCode;
    try {
        const message = await deleteEventCache(eventCode);
        logger.info(message);
        res.json({message: message})
    } catch (error) {
        const message = `❌ Failed to delete event cache`;
        logger.error({message: message, error: error})
        res.status(500).json({message: message, error: error})
    }
}

module.exports = { cleanCacheByHoursHandler, cleanCacheByEventHandler };
