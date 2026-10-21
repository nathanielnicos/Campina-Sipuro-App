const exportBatch = require('./export/exportBatchController');
const productionUpload = require('./import/productionUploadController');
const batchMapping = require('./allocated/batchMappingController');

module.exports = {
    // Export
    exportBatchMappingExcel: exportBatch.exportBatchMappingExcel,

    // Import
    previewExcelUpload: productionUpload.previewExcelUpload,
    commitExcelAllocation: productionUpload.commitExcelAllocation,

    // Allocated
    getAllocatedBatchMapping: batchMapping.getAllocatedBatchMapping,
    updateAllocationStatus: batchMapping.updateAllocationStatus,
    updateAllocationQty: batchMapping.updateAllocationQty,
    getAllocationHistory: batchMapping.getAllocationHistory
};
