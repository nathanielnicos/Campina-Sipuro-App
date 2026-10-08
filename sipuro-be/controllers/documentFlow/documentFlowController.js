const doController = require('./doController');
const siController = require('./siController');
const documentImportController = require('./documentImportController');

module.exports = {
    getDeliveryOrders: doController.getDeliveryOrders,
    getSalesInvoices: siController.getSalesInvoices,
    previewImport: documentImportController.previewImport,
    commitImport: documentImportController.commitImport
}
