const express = require('express');
const { hydrateRegistrantCacheHandler, hydrateEventCacheHandler } = require('../controllers/cacheHydrationController');

const router = express.Router();

// ✅ Hydrate a Single Registrant - MUST be above the event route
router.get('/:eventCode/:regCode([0-9-]+)', hydrateRegistrantCacheHandler);

// ✅ Hydrate an Entire Event
router.get('/:eventCode', hydrateEventCacheHandler);

module.exports = router;
