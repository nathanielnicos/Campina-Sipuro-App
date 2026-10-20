const productionLotPreviewController = require('./productionLotPreviewController');
const productionLotCommitController = require('./productionLotCommitController');

module.exports = {
    previewExcelUpload: productionLotPreviewController.previewExcelUpload,
    commitExcelAllocation: productionLotCommitController.commitExcelAllocation
};
