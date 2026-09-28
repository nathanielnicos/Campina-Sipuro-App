// Contoh di routes/poRequirementRoutes.js atau routes/testRoutes.js
const express = require('express');
const router = express.Router();
const { checkPoVsProductionPlan } = require('../jobs/poPlanScheduler');

router.get('/favicon.ico', (req, res) => res.status(204).end());

// Route khusus pengujian/trigger manual scheduler
router.get('/trigger-po-plan-check', async (req, res) => {
    try {
        const result = await checkPoVsProductionPlan();
        res.json({
            success: true,
            message: 'PO vs Production Plan check triggered manually.',
            data: result
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
