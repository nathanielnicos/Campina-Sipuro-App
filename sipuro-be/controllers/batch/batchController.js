const exportBatch = require('./export/exportBatchController');
const productionUpload = require('./import/productionUploadController');
const outstandingSummary = require('./outstanding/outstandingSummaryController');
const batchMapping = require('./allocated/batchMappingController');

module.exports = {
    // Export
    exportBatchMappingExcel: exportBatch.exportBatchMappingExcel,

    // Import
    previewExcelUpload: productionUpload.previewExcelUpload,
    commitExcelAllocation: productionUpload.commitExcelAllocation,

    // Outstanding
    getOutstandingSummary: outstandingSummary.getOutstandingSummary,

    // Allocated
    getAllocatedBatchMapping: batchMapping.getAllocatedBatchMapping,
    updateAllocationStatus: batchMapping.updateAllocationStatus,
    updateBatchNumber: batchMapping.updateBatchNumber,
};
