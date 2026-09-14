const productUpload = require('./productUploadController');
const priceUpload = require('./priceUploadController');

module.exports = {
    previewProducts: productUpload.previewProducts,
    commitProducts: productUpload.commitProducts,

    previewPrices: priceUpload.previewPrices,
    commitPrices: priceUpload.commitPrices
}
