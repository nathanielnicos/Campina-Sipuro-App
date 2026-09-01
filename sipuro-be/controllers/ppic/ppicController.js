const batchAllocation = require('./batchAllocationController');
const ppicDashboard = require('./ppicDashboardController');
const ppicExport = require('./ppicExportController');

module.exports = {
    // Batch Allocation
    getUnassignedSummary: batchAllocation.getUnassignedSummary,
    getAllocatedBatchMapping: batchAllocation.getAllocatedBatchMapping,
    getBatchesBySku: batchAllocation.getBatchesBySku,
    assignBatchBulk: batchAllocation.assignBatchBulk,

    // Dashboard
    getDashboardStats: ppicDashboard.getDashboardStats,

    // Export
    exportBatchMappingExcel: ppicExport.exportBatchMappingExcel
};
