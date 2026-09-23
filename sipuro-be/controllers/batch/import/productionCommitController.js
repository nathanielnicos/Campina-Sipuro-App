const { sipuroDb: db } = require('../../../config/db');
const { commitProductionAllocationTransaction } = require('../../../helpers/productionCommitHelper');

/**
 * Commit / Save Production Allocation Results (PPIC)
 * Processes transactions for batch insertion, allocation mapping,
 * updating PO details fulfillment status, and writing audit logs.
 */
exports.commitExcelAllocation = async (req, res) => {
    const {
        processTimestamp,
        fileHash,
        fileName,
        userId,
        allocations = [],
        newDetails = [],
        detailedAllocations = []
    } = req.body;

    // Unallocated diabaikan, validasi hanya fokus pada data valid/alokasi
    const hasData = allocations.length > 0 || newDetails.length > 0 || detailedAllocations.length > 0;
    
    if (!processTimestamp || !hasData) {
        return res.status(400).json({ 
            success: false, 
            message: 'Allocation payload cannot be empty or invalid.' 
        });
    }

    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const result = await commitProductionAllocationTransaction(connection, {
            fileName,
            processTimestamp,
            fileHash,
            userId,
            allocations,
            newDetails,
            detailedAllocations
        });

        await connection.commit();

        return res.json({ 
            success: true, 
            message: 'Production allocation successfully saved to database.',
            data: result || null
        });

    } catch (error) {
        await connection.rollback();
        console.error('Commit Production Allocation Error:', error);
        
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to save production allocation: ' + error.message 
        });
    } finally {
        connection.release();
    }
};
