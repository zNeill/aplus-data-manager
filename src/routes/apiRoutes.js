const express = require('express');
const { handleApiRequest } = require('../controllers/cacheController');

const router = express.Router();

// Certain API Emulation Routes
router.get('/:object/:accountCode/:eventCode?/:identifierCode?', handleApiRequest);

module.exports = router;
