const deliveryOrderPreviewController = require('./deliveryOrderPreviewController');
const deliveryOrderCommitController = require('./deliveryOrderCommitController');

module.exports = {
    previewDeliveryOrderUpload: deliveryOrderPreviewController.previewDeliveryOrderUpload,
    commitDeliveryOrderAllocation: deliveryOrderCommitController.commitDeliveryOrderAllocation
};
