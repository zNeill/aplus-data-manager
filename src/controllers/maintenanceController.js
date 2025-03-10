require('dotenv').config();
const pool = require('../config/db');
const logger = require('../utils/logger');


async function cleanCacheHandler(req, res) { 
    const hours = req.params.hours || 168;

    try {
        logger.info(`🗑️ Cleaning up cache: Removing entries older than ${hours} hours...`);

        const query = `
            DELETE FROM api_cache 
            WHERE created_at < NOW() - INTERVAL '${hours} hours';
        `;

        const { rowCount } = await pool.query(query);

        const message = `✅🗑 ️ Cache cleanup completed. Removed ${rowCount} old entries older than ${hours} hours.`;

        logger.info(message);
        
        res.json({"message": message})

    } catch (error) {

        const message = `❌ Cache cleanup failed: ${error.message}`;

        logger.error(message);

        res.status(500).json({ message: 'Cache cleanup failed', error: error.message });
    }
}

module.exports = { cleanCacheHandler };
