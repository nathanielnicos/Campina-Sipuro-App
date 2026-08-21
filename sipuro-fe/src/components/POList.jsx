import React, { useState, useEffect } from 'react';
import { getStatusStyle } from '../utils/statusHelper';

const POList = ({ customerId = 1, onCreateNewPO, onSelectPODetail }) => {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPOList = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await fetch(`http://localhost:5000/api/po?customer_id=${customerId}`);
                const result = await response.json();

                if (result.success) {
                    setPoList(result.data);
                } else {
                    setError(result.message || 'Gagal mengambil data PO.');
                }
            } catch (err) {
                console.error('Error fetching PO:', err);
                setError('Terjadi kesalahan jaringan atau server mati.');
            } finally {
                setLoading(false);
            }
        };

        fetchPOList();
    }, [customerId]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Daftar Purchase Order (PO)</h2>
                <button
                    onClick={onCreateNewPO}
                    style={{
                        padding: '10px 16px',
                        backgroundColor: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    + Create New PO
                </button>
            </div>

            {loading && <p>Memuat data PO...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                            <th>Kode PO</th>
                            <th>Tanggal Dibuat</th>
                            <th>Tanggal Kirim Diminta</th>
                            <th>Total Item</th>
                            <th>Total Harga (Inc. PPN)</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {poList.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                                    Belum ada Purchase Order yang dibuat.
                                </td>
                            </tr>
                        ) : (
                            poList.map((po) => (
                                <tr key={po.po_header_id}>
                                    <td><strong>{po.po_number}</strong></td>
                                    <td>{formatDate(po.created_at)}</td>
                                    <td>{formatDate(po.requested_delivery_date)}</td>
                                    <td>{po.total_items} SKU</td>
                                    <td>{formatCurrency(po.total_amount)}</td>
                                    <td>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            display: 'inline-block',
                                            ...getStatusStyle(po.status)
                                        }}>
                                            {po.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => onSelectPODetail && onSelectPODetail(po.po_header_id)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#17a2b8',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Detail
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default POList;
