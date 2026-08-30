import React, { useState } from 'react';

const UploadPreviewModal = ({ title, previewData, onClose, onConfirm }) => {
    const [submitting, setSubmitting] = useState(false);
    const { summary, data } = previewData;

    const handleConfirm = async () => {
        setSubmitting(true);
        await onConfirm(data);
        setSubmitting(false);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', width: '90%', maxWidth: '900px', maxHeight: '85vh', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h3>Preview Upload: {title}</h3>

                {/* SUMMARY BADGES */}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                    <span style={{ backgroundColor: '#198754', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                        Data Baru: {summary.newCount}
                    </span>
                    <span style={{ backgroundColor: '#fd7e14', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                        Data Berubah: {summary.updatedCount}
                    </span>
                    <span style={{ backgroundColor: '#6c757d', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                        Sama / Skip: {summary.unchangedCount}
                    </span>
                </div>

                {/* TABEL DATA PREVIEW */}
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '15px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px' }}>Kode Oracle</th>
                                <th style={{ padding: '8px' }}>Deskripsi / Nama</th>
                                <th style={{ padding: '8px' }}>Detail Perubahan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e9ecef', backgroundColor: item.status === 'NEW' ? '#e6f4ea' : item.status === 'UPDATED' ? '#fff3cd' : '#fff' }}>
                                    <td style={{ padding: '8px', fontWeight: 'bold' }}>
                                        {item.status === 'NEW' && <span style={{ color: '#198754' }}>[BARU]</span>}
                                        {item.status === 'UPDATED' && <span style={{ color: '#d97706' }}>[BERUBAH]</span>}
                                        {item.status === 'UNCHANGED' && <span style={{ color: '#6c757d' }}>[SAMA]</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>{item.product_code}</td>
                                    <td style={{ padding: '8px' }}>{item.product_name || item.description}</td>
                                    <td style={{ padding: '8px' }}>
                                        {item.changes && item.changes.length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: '15px' }}>
                                                {item.changes.map((c, cIdx) => (
                                                    <li key={cIdx}>
                                                        <strong>{c.field}:</strong> {String(c.oldVal)} $\rightarrow$ <strong>{String(c.newVal)}</strong>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span style={{ color: '#6c757d' }}>-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER ACTION */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}>
                        Batal
                    </button>
                    <button onClick={handleConfirm} disabled={submitting || (summary.newCount === 0 && summary.updatedCount === 0)} style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {submitting ? 'Menyimpan...' : 'Konfirmasi & Simpan Ke Database'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadPreviewModal;
