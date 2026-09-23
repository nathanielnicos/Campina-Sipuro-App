const poRequirementGetController = require('./poRequirementGetController');
const poRequirementManageController = require('./poRequirementManageController');

module.exports = {
    // PO Requirement Get
    getPORequirementSummary: poRequirementGetController.getPORequirementSummary,
    getPORequirementDetail: poRequirementGetController.getPORequirementDetail,
    getCustomersList: poRequirementGetController.getCustomersList,

    // PO Requirement Manage
    createDraftPO: poRequirementManageController.createDraftPO,
};
