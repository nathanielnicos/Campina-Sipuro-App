const productionPreviewController = require('./productionPreviewController');
const productionCommitController = require('./productionCommitController');

module.exports = {
    previewExcelUpload: productionPreviewController.previewExcelUpload,
    commitExcelAllocation: productionCommitController.commitExcelAllocation
};
