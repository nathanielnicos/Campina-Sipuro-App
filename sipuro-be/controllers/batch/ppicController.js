const ppicExport = require('./ppicExportController');
const unassignedProduct = require('./unassignedProductController');
const batchMapping = require('./batchMappingController');
const unallocatedStock = require('./unallocatedStockController');

module.exports = {
    // Export
    exportBatchMappingExcel: ppicExport.exportBatchMappingExcel,

    // Unassigned Product
    getUnassignedSummary: unassignedProduct.getUnassignedSummary,
    getBatchesBySku: unassignedProduct.getBatchesBySku,
    assignBatchBulk: unassignedProduct.assignBatchBulk,

    // Batch Mapping
    getAllocatedBatchMapping: batchMapping.getAllocatedBatchMapping,

    // Unallocated Stock
    getUnallocatedStocks: unallocatedStock.getUnallocatedStocks,
    reallocateUnallocatedStock: unallocatedStock.reallocateUnallocatedStock
};
