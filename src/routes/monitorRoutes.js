const express = require('express');
const { getQueueStatus } = require('../utils/certainApiQueue');

const router = express.Router();

// Get Certain API Queue Status
router.get('/queue-status', async (req, res) => {
    try {
        const status = await getQueueStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
