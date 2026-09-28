const poGetController = require('./poGetController');
const poCreateController = require('./poCreateController');
const poUpdateController = require('./poUpdateController');
const poStatusController = require('./poStatusController');
const poExportController = require('./poExportController');
const poDetailCloseController = require('./poDetailCloseController');

module.exports = {
    // PO Get
    getPOList: poGetController.getPOList,
    getPODetail: poGetController.getPODetail,

    // PO Manage
    createPO: poCreateController.createPO,
    updatePO: poUpdateController.updatePO,
    cancelPO: poUpdateController.cancelPO,
    updatePOStatus: poStatusController.updatePOStatus,

    // PO Export
    exportPoExcel: poExportController.exportPoExcel,

    // PO Detail Close
    requestClosePoDetails: poDetailCloseController.requestClosePoDetails,
    approveClosePoDetails: poDetailCloseController.approveClosePoDetails,
    rejectClosePoDetails: poDetailCloseController.rejectClosePoDetails
};
