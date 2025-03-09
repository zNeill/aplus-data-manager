require('dotenv').config();
const pool = require('../config/db');
const logger = require('../utils/logger');

async function cleanCache() {
    const CACHE_EXPIRATION_HOURS = process.env.CACHE_EXPIRATION_HOURS || 24; // Default: 24 hours

    try {
        logger.info(`🗑️ Cleaning up cache: Removing entries older than ${CACHE_EXPIRATION_HOURS} hours...`);

        const query = `
            DELETE FROM api_cache 
            WHERE created_at < NOW() - INTERVAL '${CACHE_EXPIRATION_HOURS} hours';
        `;

        const { rowCount } = await pool.query(query);

        logger.info(`✅ Cache cleanup completed. Removed ${rowCount} old entries.`);
    } catch (error) {
        logger.error(`❌ Cache cleanup failed: ${error.message}`);
    }
}

// ✅ Run the function when executed manually
if (require.main === module) {
    cleanCache();
}

module.exports = { cleanCache };
