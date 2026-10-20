const productionLotImportController = require('./import/productionLotImportController');
const productionLotListController = require('./get/productionLotListController');

module.exports = {
    // Get
    getAllocatedLotMapping: productionLotListController.getAllocatedLotMapping,

    // Import
    previewExcelUpload: productionLotImportController.previewExcelUpload,
    commitExcelAllocation: productionLotImportController.commitExcelAllocation
};
