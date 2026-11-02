const express = require('express');
const router = express.Router();
const productionScheduleController = require('../controllers/productionSchedule/productionScheduleController');
const { requirePermission } = require('../middleware/requirePermission');

// Production Schedule: izin diatur Superadmin (menu Access Permission); awalnya melihat untuk PPIC dan SUPERADMIN,
// membuat/mengubah hanya PPIC.
const viewSchedule = requirePermission('PRODUCTION_SCHEDULE', 'read');
const createDraft = requirePermission('PRODUCTION_SCHEDULE', 'create');
const savePlan = requirePermission('PRODUCTION_SCHEDULE', 'update');

// 1. RUTE STATIS (GET)
router.get('/po-requirement/summary', viewSchedule, productionScheduleController.getPORequirementSummary);
router.get('/po-requirement/customers', viewSchedule, productionScheduleController.getCustomersList);
router.get('/production-plan', viewSchedule, productionScheduleController.getProductionPlansSummary);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/po-requirement/detail/:id_product', viewSchedule, productionScheduleController.getPORequirementDetail);
router.get('/production-plan/:id_product', viewSchedule, productionScheduleController.getProductionPlanDetail);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/po-requirement/create-draft-po', createDraft, productionScheduleController.createDraftPO);
router.post('/production-plan/save', savePlan, productionScheduleController.saveProductionPlan);

module.exports = router;
