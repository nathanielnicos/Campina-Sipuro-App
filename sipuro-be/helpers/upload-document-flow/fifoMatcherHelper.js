/**
 * Logika abstraksi pencocokan FIFO berbasis kriteria tanggal
 */
const allocateFifoBatch = async (db, { productId, qtyNeeded, candidatePOs }) => {
    // Memilih batch berdasarkan urutan tanggal penyelesaian produksi tercepat (FIFO)
    const [batches] = await db.query(
        `SELECT id, po_number, available_qty, actual_completed_date 
         FROM po_batch_allocations 
         WHERE product_id = ? AND po_number IN (?) AND available_qty > 0 
         ORDER BY actual_completed_date ASC, id ASC`,
        [productId, candidatePOs]
    );

    if (!batches || batches.length === 0) return null;

    // Mengembalikan batch yang paling awal yang memenuhi alokasi
    return batches[0];
};

module.exports = { allocateFifoBatch };
