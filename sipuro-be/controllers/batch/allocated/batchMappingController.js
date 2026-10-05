const batchListController = require('./batchListController');
const batchStatusController = require('./batchStatusController');
const batchEditQtyController = require('./batchEditQtyController');
const batchAllocationLogController = require('./batchAllocationLogController');

module.exports = {
    getAllocatedBatchMapping: batchListController.getAllocatedBatchMapping,
    updateAllocationStatus: batchStatusController.updateAllocationStatus,
    updateAllocationQty: batchEditQtyController.updateAllocationQty,
    getAllocationHistory: batchAllocationLogController.getAllocationHistory
};
