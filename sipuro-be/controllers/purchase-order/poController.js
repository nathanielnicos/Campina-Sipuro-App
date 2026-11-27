const poGetController = require('./poGetController');
const poCreateController = require('./poCreateController');
const poUpdateController = require('./poUpdateController');
const poStatusController = require('./poStatusController');
const poExportController = require('./poExportController');
const poSettingController = require('./poSettingController');

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

    // PO Setting
    getPoSettings: poSettingController.getPoSettings,
    updatePoSettings: poSettingController.updatePoSettings
};
