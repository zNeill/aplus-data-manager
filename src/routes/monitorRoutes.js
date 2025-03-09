const express = require('express');
const { getQueueStatus } = require('../utils/certainApiQueue');

const router = express.Router();

// Get Certain API Queue Status
router.get('/queue-status', (req, res) => {
    const status = getQueueStatus();
    res.json(status);
});

module.exports = router;
