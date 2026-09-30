const batchListController = require('./batchListController');
const batchStatusController = require('./batchStatusController');
const batchEditQtyController = require('./batchEditQtyController');

module.exports = {
    getAllocatedBatchMapping: batchListController.getAllocatedBatchMapping,
    updateAllocationStatus: batchStatusController.updateAllocationStatus,
    updateAllocationQty: batchEditQtyController.updateAllocationQty
};
