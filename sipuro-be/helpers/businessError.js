/**
 * Error bisnis: pesannya aman ditampilkan ke user.
 * Error lain (SQL, bug, dll) dianggap error sistem -> 500 dengan pesan generik.
 */
class BusinessError extends Error {
    constructor(message, status = 400, details = null) {
        super(message);
        this.name = 'BusinessError';
        this.status = status;
        this.details = details;
    }
}

/**
 * Handler error terpusat untuk controller.
 */
const sendControllerError = (res, error, { label, fallbackMessage }) => {
    if (error instanceof BusinessError) {
        return res.status(error.status).json({
            success: false,
            message: error.message,
            ...(error.details ? { details: error.details } : {})
        });
    }

    console.error(`${label}:`, error);
    return res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

module.exports = { BusinessError, sendControllerError };
