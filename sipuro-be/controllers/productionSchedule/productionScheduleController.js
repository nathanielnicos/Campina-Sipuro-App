const poRequirement = require('./poRequirement/poRequirementController');
const productionPlan = require('./productionPlan/productionPlanController');

module.exports = {
    getPORequirementSummary: poRequirement.getPORequirementSummary,
    getPORequirementDetail: poRequirement.getPORequirementDetail,
    getCustomersList: poRequirement.getCustomersList,
    createDraftPO: poRequirement.createDraftPO,

    getProductionPlansSummary: productionPlan.getProductionPlansSummary,
    getProductionPlanDetail: productionPlan.getProductionPlanDetail,
    saveProductionPlan: productionPlan.saveProductionPlan
}
