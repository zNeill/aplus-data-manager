const express = require('express');
const { cleanCacheHandler }= require('../controllers/maintenanceController');

const router = express.Router();

// ✅ Hydrate a Single Registrant - MUST be above the event route
router.get('/clear-cache/:hours?', cleanCacheHandler);

module.exports = router;
