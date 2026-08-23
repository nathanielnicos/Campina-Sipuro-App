import React, { useState, useEffect, useCallback } from 'react';
import { fetchPOListApi } from '../../services/poApi';
import PORow from './PORow';

const POList = ({ customerId = 1, onCreateNewPO, onSelectPODetail, user }) => {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Bungkus getPOList dengan useCallback
    const getPOList = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const result = await fetchPOListApi(customerId);

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
    }, [customerId]);

    useEffect(() => {
        getPOList();
    }, [getPOList]);

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Daftar Purchase Order (PO)</h2>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {/* Tombol Create PO untuk Customer */}
                    {user?.role === 'CUSTOMER' && (
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
                    )}
                </div>
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
                                <PORow
                                    key={po.po_header_id}
                                    po={po}
                                    user={user}
                                    onSelectPODetail={onSelectPODetail}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default POList;
