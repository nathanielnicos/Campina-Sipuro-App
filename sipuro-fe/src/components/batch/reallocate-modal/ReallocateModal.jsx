import { formatQty } from '../../../utils/formatters';

const ReallocateModal = ({
    selectedStock,
    openAllocations,
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

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
                <h3>Allocate Overproduction Stock</h3>
                <p style={{ fontSize: '13px', color: '#555' }}>
                    Source Batch: <strong>{selectedStock.batch_number}</strong> | Available: <strong>{formatQty(selectedStock.qty_available)} Pcs</strong>
                </p>

                <form onSubmit={onSubmit}>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Select Target Batch / PO (Shortage):</label>
                        {loadingAlloc ? (
                            <p>Searching for target allocation...</p>
                        ) : (
                            <select
                                value={targetAllocId}
                                onChange={(e) => onTargetAllocIdChange(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
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

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Transferred Quantity:</label>
                        <input
                            type="number"
                            value={qtyToAllocate}
                            max={selectedStock.qty_available}
                            onChange={(e) => onQtyToAllocateChange(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" disabled={submitting} style={{ padding: '8px 16px', background: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            {submitting ? 'Processing...' : 'Save Allocation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReallocateModal;
