const poRequirement = require('./po-requirement/poRequirementController');
const productionPlan = require('./production-plan/productionPlanController');

module.exports = {
    getPORequirementSummary: poRequirement.getPORequirementSummary,
    getPORequirementDetail: poRequirement.getPORequirementDetail,
    getCustomersList: poRequirement.getCustomersList,
    createDraftPO: poRequirement.createDraftPO,

    getProductionPlansSummary: productionPlan.getProductionPlansSummary,
    getProductionPlanDetail: productionPlan.getProductionPlanDetail,
    saveProductionPlan: productionPlan.saveProductionPlan
}
