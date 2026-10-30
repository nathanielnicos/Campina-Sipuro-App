// Fungsi murni untuk tampilan ringkas (tanpa lot) di mode By PO dan By Batch.
// Data tetap dari server per lot; di sini hanya dijumlahkan. Qty yang dihitung = semua alokasi selain Canceled
// (sama dengan rumus fulfilled_qty di server). Jika daftar difilter status, jumlahnya mengikuti baris yang tampil.

const isCounted = (alloc) => alloc.status !== 'Canceled';

export const sumAllocatedQty = (allocations = []) => allocations.reduce(
    (sum, a) => (isCounted(a) ? sum + (Number(a.allocated_qty) || 0) : sum),
    0
);

// Aturan sama dengan status batch di server: semua Canceled -> Canceled; ada Open -> Open;
// ada Force Closed -> Force Closed; selain itu Closed.
export const resolveStatus = (statuses = []) => {
    if (statuses.length === 0) return '-';
    if (statuses.every((s) => s === 'Canceled')) return 'Canceled';
    if (statuses.includes('Open')) return 'Open';
    if (statuses.includes('Force Closed')) return 'Force Closed';
    return 'Closed';
};

// Status item PO untuk tampilan. Close Requested / Closed / Partially Closed datang dari alur Outstanding PO;
// item Active tampil Open selama masih ada sisa, dan Closed bila sudah terpenuhi penuh.
export const poItemStatusLabel = (product) => {
    const status = product && product.item_status;
    if (status === 'Close Requested' || status === 'Closed' || status === 'Partially Closed') return status;
    return Number(product && product.remaining_qty) > 0 ? 'Open' : 'Closed';
};

// Satu item PO: qty dan jumlah lot (bukan Canceled) per batch.
export const summarizePoItem = (product) => {
    const batches = (Array.isArray(product.batches) ? product.batches : []).map((batch) => {
        const lots = Array.isArray(batch.lots) ? batch.lots : [];
        return {
            batch_id: batch.batch_id,
            batch_number: batch.batch_number,
            qty: sumAllocatedQty(lots),
            lotCount: lots.filter(isCounted).length
        };
    });
    return { batches };
};

// Satu batch: total qty, jumlah lot, dan qty per PO (alokasi dari semua lot digabung per PO).
export const summarizeBatch = (batch) => {
    const lots = Array.isArray(batch.lots) ? batch.lots : [];
    const allocations = lots.flatMap((lot) => (Array.isArray(lot.po_allocations) ? lot.po_allocations : []));

    const byPo = new Map();
    allocations.forEach((a) => {
        const key = `${a.po_number}|${a.po_product_code}`;
        if (!byPo.has(key)) {
            byPo.set(key, {
                key,
                po_number: a.po_number,
                po_product_code: a.po_product_code,
                is_cross_code: a.is_cross_code,
                qty: 0,
                statuses: []
            });
        }
        const entry = byPo.get(key);
        entry.qty += isCounted(a) ? Number(a.allocated_qty) || 0 : 0;
        entry.statuses.push(a.status);
    });

    return {
        // Lot yang seluruh alokasinya Canceled tidak dihitung, sama seperti qty
        lotCount: lots.filter((lot) => (lot.po_allocations || []).some(isCounted)).length,
        totalQty: sumAllocatedQty(allocations),
        poAllocations: Array.from(byPo.values()).map(({ statuses, ...rest }) => ({ ...rest, status: resolveStatus(statuses) }))
    };
};
