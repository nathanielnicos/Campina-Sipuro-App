const express = require('express');
const router = express.Router();
const productionPlanController = require('../controllers/productionPlanController');

// Routing API Production Plan
router.get('/', productionPlanController.getProductionPlansSummary);
router.get('/:id_product', productionPlanController.getProductionPlanDetail);
router.post('/save', productionPlanController.saveProductionPlan);

module.exports = router;
