import React from 'react';

const ConfirmCreatePOModal = ({
    isOpen,
    onClose,
    items,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    onConfirm,
    loading
}) => {
    if (!isOpen) return null;

    const filteredItems = items.filter(item => item.required_po_qty > 0);

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
                maxWidth: '600px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                        Konfirmasi Pembuatan Draft PO
                    </h3>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Pilih Customer */}
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                            Pilih Customer:
                        </label>
                        <select
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '13px'
                            }}
                        >
                            {customers.map(c => (
                                <option key={c.customer_id} value={c.customer_id}>
                                    {c.company_name} ({c.customer_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Ringkasan Produk */}
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                            Ringkasan Produk yang Diproses:
                        </label>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Kode & Nama Produk</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>Qty Required (Pcs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => (
                                        <tr key={item.id_product} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '8px' }}>
                                                {item.product_code} - {item.product_name}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                                {Number(item.required_po_qty).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#6c757d', fontStyle: 'italic' }}>
                        * Harga per unit, subtotal, PPN, dan grand total akan dikalkulasi otomatis oleh sistem saat PO disimpan.
                    </div>
                </div>

                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    backgroundColor: '#f8f9fa'
                }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6c757d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#0d6efd',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {loading ? 'Memproses...' : 'Buat Draft PO'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmCreatePOModal;
