/**
 * Document Flow upload configuration. Change values here if needed.
 * File size limit is shared with the uploadConfig.js.
 */
module.exports = {
    // Maximum number of data rows per upload (SubTot / Grand Total rows are excluded)
    MAX_UPLOAD_ROWS: 1000,
    // MySQL advisory lock name so Document Flow commits run one at a time
    COMMIT_LOCK_NAME: 'sipuro_document_flow_commit',
    COMMIT_LOCK_TIMEOUT_SECONDS: 10,
    // Only rows with this Delivery Status (case-insensitive) are processed
    INTERFACED_STATUS: 'INTERFACED',
    // Number of rows per bulk INSERT
    INSERT_CHUNK_SIZE: 200,
    // Offset appended to datetime strings sent to the frontend (database stores WIB wall-clock)
    WIB_OFFSET: '+07:00'
};
