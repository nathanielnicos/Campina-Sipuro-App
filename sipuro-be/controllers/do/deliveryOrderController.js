const deliveryOrderImportController = require('./import/deliveryOrderImportController');
const deliveryOrderListController = require('./get/deliveryOrderListController');

module.exports = {
    // Get
    getDeliveryOrderMapping: deliveryOrderListController.getDeliveryOrderMapping,
    
    // Import
    previewDeliveryOrderUpload: deliveryOrderImportController.previewDeliveryOrderUpload,
    commitDeliveryOrderAllocation: deliveryOrderImportController.commitDeliveryOrderAllocation
};
