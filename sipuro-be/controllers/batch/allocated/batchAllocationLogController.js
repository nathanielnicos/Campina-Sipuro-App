const { sipuroDb } = require('../../../config/db');
const { getAllocationLogs } = require('../../../helpers/poBatchAllocationLogHelper');

/**
 * Get Allocation History Logs by Allocation ID
 */
exports.getAllocationHistory = async (req, res) => {
    try {
        const { allocationId } = req.params;

        // Parse & sanitize query parameters
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

        // Validate allocationId (karena bertipe int)
        if (!allocationId || isNaN(allocationId)) {
            return res.status(400).json({
                success: false,
                message: 'A valid Allocation ID is required.'
            });
        }

        const result = await getAllocationLogs(sipuroDb, allocationId, page, limit);

        return res.status(200).json({
            success: true,
            message: 'Allocation logs fetched successfully.',
            data: result.logs,
            pagination: result.pagination
        });

    } catch (error) {
        console.error('Error getAllocationHistory:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching allocation history logs.',
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
};
