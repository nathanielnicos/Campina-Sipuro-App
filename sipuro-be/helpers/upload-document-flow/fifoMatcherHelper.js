/**
 * Pure FIFO allocation (no database access).
 *
 * Rules:
 *  - Candidates: allocations of the same product whose PO is referenced by the Customer PO cell.
 *  - A candidate is usable only when  fifoDate <= DO creation datetime  (strings 'YYYY-MM-DD HH:mm:ss').
 *  - Order: fifoDate ascending, then allocationId ascending.
 *  - One DO line may be split over several allocations.
 *  - All-or-nothing: when the quantity cannot be fully allocated nothing is consumed.
 *
 * `ledger` is a Map(allocationId -> remaining pcs) shared by all rows of one file, so the preview
 * result is exactly the result of the commit.
 */

const REASONS = {
    NO_ALLOCATION: 'NO_ALLOCATION',
    NOT_COMPLETED_YET: 'NOT_COMPLETED_YET',
    NO_CAPACITY: 'NO_CAPACITY',
    INSUFFICIENT: 'INSUFFICIENT'
};

const compareFifo = (a, b) => {
    if (a.fifoDate !== b.fifoDate) return a.fifoDate < b.fifoDate ? -1 : 1;
    return a.allocationId - b.allocationId;
};

/**
 * @param {{ qtyPcs:number, doCreatedAt:string, candidates:object[], ledger:Map<number,number> }} input
 * @returns {{ ok:true, parts:{allocation:object, qtyPcs:number}[] } | { ok:false, reason:string, message:string }}
 */
const allocateFifo = ({ qtyPcs, doCreatedAt, candidates, ledger }) => {
    if (!candidates || candidates.length === 0) {
        return {
            ok: false,
            reason: REASONS.NO_ALLOCATION,
            message: 'No batch allocation found for this item in the referenced PO.'
        };
    }

    const completed = candidates.filter((c) => c.fifoDate && c.fifoDate <= doCreatedAt);
    if (completed.length === 0) {
        const earliest = candidates.map((c) => c.fifoDate).filter(Boolean).sort()[0];
        return {
            ok: false,
            reason: REASONS.NOT_COMPLETED_YET,
            message: `DO creation date (${doCreatedAt}) is earlier than the batch completion date (earliest: ${earliest || 'unknown'}).`
        };
    }

    const usable = completed
        .filter((c) => (ledger.get(c.allocationId) || 0) > 0)
        .sort(compareFifo);

    const available = usable.reduce((sum, c) => sum + (ledger.get(c.allocationId) || 0), 0);
    if (usable.length === 0) {
        return {
            ok: false,
            reason: REASONS.NO_CAPACITY,
            message: 'All eligible batch allocations are already fully delivered.'
        };
    }
    if (available < qtyPcs) {
        return {
            ok: false,
            reason: REASONS.INSUFFICIENT,
            message: `Insufficient allocated quantity: ${qtyPcs} pcs needed, ${available} pcs available.`
        };
    }

    let remaining = qtyPcs;
    const parts = [];
    for (const candidate of usable) {
        if (remaining <= 0) break;
        const capacity = ledger.get(candidate.allocationId) || 0;
        const take = Math.min(capacity, remaining);
        if (take <= 0) continue;
        parts.push({ allocation: candidate, qtyPcs: take });
        remaining -= take;
    }

    // Consume only after the whole quantity is secured
    parts.forEach((p) => ledger.set(p.allocation.allocationId, (ledger.get(p.allocation.allocationId) || 0) - p.qtyPcs));

    return { ok: true, parts };
};

module.exports = { allocateFifo, REASONS };
