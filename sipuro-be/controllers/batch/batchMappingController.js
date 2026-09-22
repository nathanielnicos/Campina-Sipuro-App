const batchListController = require('./batchListController');
const batchStatusController = require('./batchStatusController');
const batchRenameController = require('./batchRenameController');

module.exports = {
    getAllocatedBatchMapping: batchListController.getAllocatedBatchMapping,
    updateAllocationStatus: batchStatusController.updateAllocationStatus,
    updateBatchNumber: batchRenameController.updateBatchNumber
};
