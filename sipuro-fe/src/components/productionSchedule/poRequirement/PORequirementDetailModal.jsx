import React from 'react';
import { formatDate } from '../../../utils/dateHelper';
import { formatQty } from '../../../utils/formatters';

const PORequirementDetailModal = ({
    isOpen,
    onClose,
    product,
    modalData,
    loading
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '950px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden'
            }}>
                {/* Header Modal */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f8f9fa'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#212529' }}>
                            Breakdown Detail PO Requirement
                        </h3>
                        {product && (
                            <span style={{ fontSize: '13px', color: '#6c757d' }}>
                                {product.product_code} - {product.product_name}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: '#6c757d',
                            cursor: 'pointer'
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body Modal */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6c757d' }}>
                            Loading detail data...
                        </div>
                    ) : !modalData ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6c757d' }}>
                            No detail data available.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            {/* Bagian 1: Weekly Production Plan & PO Allocation Breakdown */}
                            <div>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0d6efd', fontWeight: '700' }}>
                                    Production Plan & PO Allocation Breakdown (Per Week)
                                </h4>
                                <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                {modalData.weeks?.map((w) => (
                                                    <th key={`${w.year}_${w.week_number}`} style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #dee2e6', minWidth: '130px', verticalAlign: 'top' }}>
                                                        <div>Week {w.week_number}</div>
                                                        <div style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal' }}>
                                                            {w.date_label}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Baris Total Plan Qty Per Week */}
                                            <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                                                {modalData.weeks?.map((w) => (
                                                    <td key={`${w.year}_${w.week_number}`} style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#fdfdfd', borderRight: '1px solid #dee2e6' }}>
                                                        {formatQty(w.plan_qty)}
                                                    </td>
                                                ))}
                                            </tr>

                                            {/* Baris List Breakdown PO Teralokasi (FIFO) */}
                                            <tr>
                                                {modalData.weeks?.map((w) => (
                                                    <td key={`${w.year}_${w.week_number}`} style={{ padding: '10px 8px', textAlign: 'left', verticalAlign: 'top', borderRight: '1px solid #dee2e6', backgroundColor: '#fff' }}>
                                                        {w.allocated_pos && w.allocated_pos.length > 0 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {w.allocated_pos.map((poItem, idx) => (
                                                                    <div key={idx} style={{
                                                                        padding: '6px',
                                                                        borderRadius: '4px',
                                                                        backgroundColor: '#e7f1ff',
                                                                        border: '1px solid #b6d4fe',
                                                                        fontSize: '11px'
                                                                    }}>
                                                                        <div style={{ fontWeight: '700', color: '#084298', wordBreak: 'break-all' }}>
                                                                            {poItem.po_number}
                                                                        </div>
                                                                        <div style={{ color: '#0d6efd', fontWeight: '600', marginTop: '2px' }}>
                                                                            {formatQty(poItem.allocated_qty)} Pcs
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Warning jika rencana minggu tersebut melebihi sisa PO yang ada */}
                                                                {w.uncovered_qty > 0 && (
                                                                    <div style={{
                                                                        padding: '4px 6px',
                                                                        borderRadius: '4px',
                                                                        backgroundColor: '#fff3cd',
                                                                        border: '1px solid #ffecb5',
                                                                        color: '#664d03',
                                                                        fontSize: '10px',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        Uncovered: {formatQty(w.uncovered_qty)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : w.plan_qty > 0 ? (
                                                            <div style={{
                                                                padding: '6px',
                                                                borderRadius: '4px',
                                                                backgroundColor: '#f8d7da',
                                                                border: '1px solid #f5c2c7',
                                                                color: '#842029',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                textAlign: 'center'
                                                            }}>
                                                                No PO Available
                                                            </div>
                                                        ) : (
                                                            <div style={{ textAlign: 'center', color: '#adb5bd', fontSize: '11px' }}>
                                                                -
                                                            </div>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Bagian 2: Daftar Outstanding PO Related */}
                            <div>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0d6efd', fontWeight: '700' }}>
                                    Outstanding Purchase Orders
                                </h4>
                                <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                                <th style={{ padding: '10px 12px', textAlign: 'left', borderRight: '1px solid #dee2e6' }}>PO Number</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #dee2e6' }}>Created Date</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid #dee2e6' }}>Required Qty</th>
                                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Remaining Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {!modalData.outstanding_pos || modalData.outstanding_pos.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#6c757d' }}>
                                                        Tidak ada PO outstanding untuk produk ini.
                                                    </td>
                                                </tr>
                                            ) : (
                                                modalData.outstanding_pos.map((po) => (
                                                    <tr key={po.po_header_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#212529', borderRight: '1px solid #dee2e6' }}>
                                                            {po.po_number}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #dee2e6' }}>
                                                            {formatDate(po.created_date)}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid #dee2e6' }}>
                                                            {formatQty(po.required_qty)}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#dc3545' }}>
                                                            {formatQty(po.remaining_qty)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    backgroundColor: '#f8f9fa'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PORequirementDetailModal;
