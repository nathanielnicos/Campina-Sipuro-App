const outstandingList = require('./outstandingListController');
const outstandingClose = require('./outstandingCloseController');

module.exports = {
    // Daftar
    getOutstandingList: outstandingList.getOutstandingList,

    // Close PO Item
    requestClose: outstandingClose.requestClose,
    approveClose: outstandingClose.approveClose,
    rejectClose: outstandingClose.rejectClose
};
