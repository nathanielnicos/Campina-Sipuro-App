import { useEffect } from 'react';
import { formatQty } from '../../../utils/formatters';

const th = (extra = {}) => ({ padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap', ...extra });
const td = (extra = {}) => ({ padding: '8px 12px', ...extra });
const sectionTitle = { margin: '16px 0 6px', fontSize: '13px', fontWeight: 600, color: '#212529' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
const headRow = { backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' };

const StatusChange = ({ before, after }) => (
    before === after
        ? <span>{after}</span>
        : <span>{before} &rarr; <strong>{after}</strong></span>
);

const signed = (n) => (n > 0 ? `+${formatQty(n)}` : formatQty(n));

const RebalanceAllocationModal = ({
    isOpen, onClose, products = [], productId, onProductChange, preview, reason, onReasonChange, reasonMaxLength = 50,
    error = '', loadingProducts = false, previewing = false, saving = false, onPreview, onCommit
}) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const busy = previewing || saving;
    const canCommit = Boolean(preview && preview.canApply) && reason.trim().length > 0 && !busy;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1050,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '1000px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden', position: 'relative'
            }}>
                <div style={{ padding: '16px 48px 16px 20px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#212529' }}>Rebalance Allocation</h5>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                        Fills older PO items first by moving later lot allocations forward. Lot and batch totals do not change. Nothing is saved before you apply.
                    </div>
                </div>

                <button
                    type="button" onClick={onClose} title="Close Modal" disabled={saving}
                    style={{ position: 'absolute', top: '12px', right: '16px', border: 'none', background: 'transparent', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', color: '#6c757d', lineHeight: 1, padding: '4px 8px', zIndex: 10 }}
                >
                    &times;
                </button>

                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label htmlFor="rebalance-product" style={{ fontSize: '13px', fontWeight: 600 }}>Product</label>
                        <select
                            id="rebalance-product" value={productId} disabled={loadingProducts || busy}
                            onChange={(e) => onProductChange(e.target.value)}
                            style={{ minWidth: '320px', padding: '6px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                        >
                            <option value="">{loadingProducts ? 'Loading products...' : 'Select product'}</option>
                            {products.map((p) => (
                                <option key={p.id_product} value={p.id_product}>{p.product_code} - {p.product_name}</option>
                            ))}
                        </select>
                        <button
                            type="button" onClick={onPreview} disabled={!productId || busy}
                            style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: !productId || busy ? '#9ec5fe' : '#0d6efd', cursor: !productId || busy ? 'not-allowed' : 'pointer' }}
                        >
                            {previewing ? 'Calculating...' : 'Preview'}
                        </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                        Products with the same code mapping (old and new code) are rebalanced together.
                    </div>

                    {error && <div style={{ color: '#dc3545', marginTop: '12px', fontSize: '13px' }}>{error}</div>}

                    {preview && preview.blockers.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#f8d7da', color: '#842029', borderRadius: '4px', fontSize: '13px' }}>
                            <strong>Cannot rebalance:</strong>
                            <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                                {preview.blockers.map((b) => <li key={b}>{b}</li>)}
                            </ul>
                        </div>
                    )}

                    {preview && preview.noChange && (
                        <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#d1e7dd', color: '#0f5132', borderRadius: '4px', fontSize: '13px' }}>
                            The allocation is already in order. Nothing needs to be moved.
                        </div>
                    )}

                    {preview && preview.reversals.length > 0 && (
                        <>
                            <h6 style={sectionTitle}>Manual edits that will be reversed ({preview.reversals.length})</h6>
                            <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '6px' }}>
                                Each manual quantity edit is cancelled with an opposite record (history is kept).
                            </div>
                            <table style={tableStyle}>
                                <thead><tr style={headRow}>
                                    <th style={th()}>PO</th><th style={th()}>Lot</th><th style={th()}>Batch</th>
                                    <th style={th({ textAlign: 'right' })}>Manual Edit</th><th style={th({ textAlign: 'right' })}>Qty Change</th>
                                </tr></thead>
                                <tbody>
                                    {preview.reversals.map((r) => (
                                        <tr key={r.allocationId} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={td()}>{r.poNumber}</td><td style={td()}>{r.lotNumber}</td><td style={td()}>{r.batchNumber}</td>
                                            <td style={td({ textAlign: 'right' })}>{signed(r.manualDelta)}</td>
                                            <td style={td({ textAlign: 'right', whiteSpace: 'nowrap' })}>{formatQty(r.from)} &rarr; <strong>{formatQty(r.to)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {preview && preview.poSummary.length > 0 && (
                        <>
                            <h6 style={sectionTitle}>PO items affected ({preview.poSummary.length})</h6>
                            <table style={tableStyle}>
                                <thead><tr style={headRow}>
                                    <th style={th()}>PO</th><th style={th()}>Product</th>
                                    <th style={th({ textAlign: 'right' })}>PO Qty</th>
                                    <th style={th({ textAlign: 'right' })}>Fulfilled Qty</th><th style={th()}>Status</th>
                                </tr></thead>
                                <tbody>
                                    {preview.poSummary.map((p) => (
                                        <tr key={p.poDetailId} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={td()}>{p.poNumber}</td><td style={td()}>{p.productCode}</td>
                                            <td style={td({ textAlign: 'right' })}>{formatQty(p.baseQty)}</td>
                                            <td style={td({ textAlign: 'right', whiteSpace: 'nowrap' })}>{formatQty(p.fulfilledBefore)} &rarr; <strong>{formatQty(p.fulfilledAfter)}</strong></td>
                                            <td style={td({ whiteSpace: 'nowrap' })}><StatusChange before={p.statusBefore} after={p.statusAfter} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {preview && preview.changes.length > 0 && (
                        <>
                            <h6 style={sectionTitle}>Allocation changes ({preview.changes.length})</h6>
                            <table style={tableStyle}>
                                <thead><tr style={headRow}>
                                    <th style={th()}>Lot</th><th style={th()}>Batch</th><th style={th()}>PO</th>
                                    <th style={th({ textAlign: 'right' })}>Allocated Qty</th><th style={th({ textAlign: 'right' })}>Change</th>
                                </tr></thead>
                                <tbody>
                                    {preview.changes.map((c) => (
                                        <tr key={`${c.poDetailId}_${c.lotId}_${c.batchId}`} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={td()}>{c.lotNumber}</td><td style={td()}>{c.batchNumber}</td><td style={td()}>{c.poNumber}</td>
                                            <td style={td({ textAlign: 'right', whiteSpace: 'nowrap' })}>{formatQty(c.currentQty)} &rarr; <strong>{formatQty(c.finalQty)}</strong></td>
                                            <td style={td({ textAlign: 'right', color: c.finalQty >= c.currentQty ? '#0f5132' : '#842029' })}>{signed(c.finalQty - c.currentQty)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                <div style={{ padding: '12px 20px', borderTop: '1px solid #dee2e6', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text" value={reason} maxLength={reasonMaxLength} disabled={!preview || !preview.canApply || busy}
                        onChange={(e) => onReasonChange(e.target.value)}
                        placeholder={`Reason (required, max ${reasonMaxLength} characters)`}
                        style={{ flex: 1, minWidth: '240px', padding: '6px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                    />
                    <button type="button" onClick={onClose} disabled={saving}
                        style={{ padding: '6px 14px', border: '1px solid #ced4da', borderRadius: '4px', backgroundColor: '#fff', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        Cancel
                    </button>
                    <button type="button" onClick={onCommit} disabled={!canCommit}
                        style={{ padding: '6px 14px', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: canCommit ? '#198754' : '#a3cfbb', cursor: canCommit ? 'pointer' : 'not-allowed' }}>
                        {saving ? 'Saving...' : 'Apply Rebalance'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RebalanceAllocationModal;
