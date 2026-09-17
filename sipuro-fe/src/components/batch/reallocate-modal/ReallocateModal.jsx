import React from 'react';
import { formatQty } from '../../../utils/formatters';

const ReallocateModal = ({
    selectedStock,
    openAllocations = [],
    targetAllocId,
    qtyToAllocate,
    loadingAlloc,
    submitting,
    onTargetAllocIdChange,
    onQtyToAllocateChange,
    onClose,
    onSubmit
}) => {
    if (!selectedStock) return null;

    // Cari alokasi target yang sedang dipilih untuk mendapatkan remaining_qty
    const selectedTargetAlloc = openAllocations.find(
        (alloc) => String(alloc.allocation_id) === String(targetAllocId)
    );

    const availableStock = Number(selectedStock.qty_available || 0);
    const targetRemainingQty = selectedTargetAlloc ? Number(selectedTargetAlloc.remaining_qty || 0) : null;

    // Batas maksimal input: terkecil antara stok tersedia & sisa kebutuhan PO target
    const maxAllowedQty = targetRemainingQty !== null
        ? Math.min(availableStock, targetRemainingQty)
        : availableStock;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '480px', maxWidth: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Allocate Overproduction Stock</h3>
                <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px', borderBottom: '1px solid #eee', pb: '8px' }}>
                    Source Batch: <strong>{selectedStock.batch_number}</strong> | Available: <strong style={{ color: '#198754' }}>{formatQty(availableStock)} Pcs</strong>
                </p>

                <form onSubmit={onSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>
                            Select Target Batch / PO (Shortage):
                        </label>
                        {loadingAlloc ? (
                            <p style={{ fontSize: '12px', color: '#666' }}>Searching for target allocation...</p>
                        ) : (
                            <select
                                value={targetAllocId}
                                onChange={(e) => onTargetAllocIdChange(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' }}
                                required
                            >
                                <option value="">-- Select Target Batch / PO --</option>
                                {openAllocations.map((alloc) => (
                                    <option key={alloc.allocation_id} value={alloc.allocation_id}>
                                        PO: {alloc.po_number} | Batch: {alloc.batch_number} (Shortage: {formatQty(alloc.remaining_qty)} Pcs)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>
                            Transferred Quantity:
                        </label>
                        <input
                            type="number"
                            value={qtyToAllocate}
                            min="1"
                            max={maxAllowedQty}
                            onChange={(e) => onQtyToAllocateChange(e.target.value)}
                            placeholder="Enter quantity"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '8px 10px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '13px'
                            }}
                            required
                        />
                        <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                            {selectedTargetAlloc ? (
                                <span>Max transferable: <strong>{formatQty(maxAllowedQty)} Pcs</strong> (Target shortage: {formatQty(targetRemainingQty)} Pcs)</span>
                            ) : (
                                <span>Max transferable: <strong>{formatQty(availableStock)} Pcs</strong></span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            style={{
                                padding: '8px 16px',
                                border: '1px solid #ccc',
                                background: '#fff',
                                borderRadius: '4px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1,
                                fontSize: '13px'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                padding: '8px 16px',
                                background: '#198754',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1,
                                fontWeight: 'bold',
                                fontSize: '13px'
                            }}
                        >
                            {submitting ? 'Processing...' : 'Save Allocation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReallocateModal;
