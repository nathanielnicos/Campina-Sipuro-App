const preview = require('./import/salesInvoicePreviewController');
const commit = require('./import/salesInvoiceCommitController');
const list = require('./get/salesInvoiceListController');

module.exports = {
    previewSalesInvoiceUpload: preview.previewSalesInvoiceUpload,
    commitSalesInvoiceAllocation: commit.commitSalesInvoiceAllocation,
    getSalesInvoiceMapping: list.getSalesInvoiceMapping
};
