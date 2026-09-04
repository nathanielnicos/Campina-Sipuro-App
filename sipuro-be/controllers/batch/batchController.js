const exportBatch = require('./exportBatchController');
const unassignedProduct = require('./unassignedProductController');
const batchMapping = require('./batchMappingController');
const unallocatedStock = require('./unallocatedStockController');

module.exports = {
    // Export
    exportBatchMappingExcel: exportBatch.exportBatchMappingExcel,

    // Unassigned Product
    getUnassignedSummary: unassignedProduct.getUnassignedSummary,
    getBatchesBySku: unassignedProduct.getBatchesBySku,
    assignBatchBulk: unassignedProduct.assignBatchBulk,

    // Batch Mapping
    getAllocatedBatchMapping: batchMapping.getAllocatedBatchMapping,
    updateAllocationStatus: batchMapping.updateAllocationStatus,

    // Unallocated Stock
    getUnallocatedStocks: unallocatedStock.getUnallocatedStocks,
    getOpenAllocationsByProduct: unallocatedStock.getOpenAllocationsByProduct,
    reallocateUnallocatedStock: unallocatedStock.reallocateUnallocatedStock
};
