const batchAllocation = require('./batchAllocationController');
const ppicExport = require('./ppicExportController');

module.exports = {
    // Batch Allocation
    getUnassignedSummary: batchAllocation.getUnassignedSummary,
    getAllocatedBatchMapping: batchAllocation.getAllocatedBatchMapping,
    getBatchesBySku: batchAllocation.getBatchesBySku,
    assignBatchBulk: batchAllocation.assignBatchBulk,

    // Export
    exportBatchMappingExcel: ppicExport.exportBatchMappingExcel
};
