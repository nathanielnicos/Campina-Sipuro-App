const productionPlanGetController = require('./productionPlanGetController');
const productionPlanManageController = require('./productionPlanManageController');

module.exports = {
    // Production Plan Get
    getProductionPlansSummary: productionPlanGetController.getProductionPlansSummary,
    getProductionPlanDetail: productionPlanGetController.getProductionPlanDetail,

    // Production Plan Manage
    saveProductionPlan: productionPlanManageController.saveProductionPlan,
};
