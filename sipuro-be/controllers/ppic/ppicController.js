const batchAllocation = require('./batchAllocationController');
const productionOutput = require('./productionOutputController');
const ppicDashboard = require('./ppicDashboardController');
const ppicExport = require('./ppicExportController');

module.exports = {
    // Batch Allocation
    getUnassignedSummary: batchAllocation.getUnassignedSummary,
    getAllocatedBatchMapping: batchAllocation.getAllocatedBatchMapping,
    getBatchesBySku: batchAllocation.getBatchesBySku,
    assignBatchBulk: batchAllocation.assignBatchBulk,

    // Production Output
    previewProduction: productionOutput.previewProduction,
    confirmProduction: productionOutput.confirmProduction,

    // Dashboard
    getDashboardStats: ppicDashboard.getDashboardStats,

    // Export
    exportBatchMappingExcel: ppicExport.exportBatchMappingExcel
};
