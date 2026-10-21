const express = require('express');
const router = express.Router();
const productionScheduleController = require('../controllers/productionSchedule/productionScheduleController');
const { requireAccess } = require('../middleware/auth');

// Production Schedule: melihat untuk PPIC dan SUPERADMIN; mengubah/membuat hanya PPIC.
const viewSchedule = requireAccess('PPIC', 'SUPERADMIN');
const ppicOnly = requireAccess('PPIC');

// 1. RUTE STATIS (GET)
router.get('/po-requirement/summary', viewSchedule, productionScheduleController.getPORequirementSummary);
router.get('/po-requirement/customers', viewSchedule, productionScheduleController.getCustomersList);
router.get('/production-plan', viewSchedule, productionScheduleController.getProductionPlansSummary);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/po-requirement/detail/:id_product', viewSchedule, productionScheduleController.getPORequirementDetail);
router.get('/production-plan/:id_product', viewSchedule, productionScheduleController.getProductionPlanDetail);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/po-requirement/create-draft-po', ppicOnly, productionScheduleController.createDraftPO);
router.post('/production-plan/save', ppicOnly, productionScheduleController.saveProductionPlan);

module.exports = router;
