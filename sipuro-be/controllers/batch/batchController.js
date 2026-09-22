const exportBatch = require('./exportBatchController');
const outstandingSummary = require('./outstandingSummaryController');
const batchMapping = require('./batchMappingController');
const unallocatedStock = require('./unallocatedStockController');

module.exports = {
    // Export
    exportBatchMappingExcel: exportBatch.exportBatchMappingExcel,

    // Outstanding Summary
    getOutstandingSummary: outstandingSummary.getOutstandingSummary,

    // Batch Mapping
    getAllocatedBatchMapping: batchMapping.getAllocatedBatchMapping,
    updateAllocationStatus: batchMapping.updateAllocationStatus,
    updateBatchNumber: batchMapping.updateBatchNumber,

    // Unallocated Stock
    getUnallocatedStocks: unallocatedStock.getUnallocatedStocks,
    getOpenAllocationsByProduct: unallocatedStock.getOpenAllocationsByProduct,
    reallocateUnallocatedStock: unallocatedStock.reallocateUnallocatedStock
};
