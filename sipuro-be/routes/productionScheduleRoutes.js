const express = require('express');
const router = express.Router();
const productionScheduleController = require('../controllers/productionSchedule/productionScheduleController');

// 1. RUTE STATIS (GET)
router.get('/po-requirement/summary', productionScheduleController.getPORequirementSummary);
router.get('/po-requirement/customers', productionScheduleController.getCustomersList);
router.get('/production-plan', productionScheduleController.getProductionPlansSummary);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/po-requirement/detail/:id_product', productionScheduleController.getPORequirementDetail);
router.get('/production-plan/:id_product', productionScheduleController.getProductionPlanDetail);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/po-requirement/create-draft-po', productionScheduleController.createDraftPO);
router.post('/production-plan/save', productionScheduleController.saveProductionPlan);

module.exports = router;
