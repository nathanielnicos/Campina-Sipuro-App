const express = require('express');
const router = express.Router();
const poRequirementController = require('../controllers/poRequirementController');

router.get('/summary', poRequirementController.getPORequirementSummary);
router.get('/detail/:id_product', poRequirementController.getPORequirementDetail);
router.get('/customers', poRequirementController.getCustomersList);
router.post('/create-draft-po', poRequirementController.createDraftPO);

module.exports = router;
