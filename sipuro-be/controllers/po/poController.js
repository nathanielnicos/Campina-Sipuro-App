const poGetController = require('./poGetController');
const poManageController = require('./poManageController');
const poExportController = require('./poExportController');

module.exports = {
    // PO Get
    getPOList: poGetController.getPOList,
    getPODetail: poGetController.getPODetail,

    // PO Manage
    createPO: poManageController.createPO,
    updatePO: poManageController.updatePO,
    cancelPO: poManageController.cancelPO,
    updatePOStatus: poManageController.updatePOStatus,

    // Export Controller
    exportPoExcel: poExportController.exportPoExcel,
};
