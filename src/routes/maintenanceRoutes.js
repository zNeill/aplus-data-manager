const express = require('express');
const { cleanCacheByHoursHandler, cleanCacheByEventHandler }= require('../controllers/maintenanceController');
const { resetEventCacheHandler } = require('../controllers/cacheHydrationController');

const router = express.Router();
router.get('/clear/event/:eventCode', cleanCacheByEventHandler);

router.get('/clear/all/:hours?', cleanCacheByHoursHandler);

router.get('/refresh/event/:eventCode',resetEventCacheHandler);

module.exports = router;
