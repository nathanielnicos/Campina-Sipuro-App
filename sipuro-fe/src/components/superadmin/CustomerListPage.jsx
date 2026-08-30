import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CustomerListPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const res = await axios.get('/api/customers');
            setCustomers(res.data.data || res.data);
        } catch (err) {
            console.error('Gagal mengambil data customer:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Daftar Pengguna Pelanggan</h3>
            </div>

            {loading ? (
                <div>Memuat data pelanggan...</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>Kode Customer</th>
                            <th style={{ padding: '10px' }}>Nama Perusahaan</th>
                            <th style={{ padding: '10px' }}>Email</th>
                            <th style={{ padding: '10px' }}>Telepon</th>
                            <th style={{ padding: '10px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data pelanggan</td></tr>
                        ) : (
                            customers.map((c) => (
                                <tr key={c.customer_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{c.customer_code}</td>
                                    <td style={{ padding: '10px' }}>{c.company_name}</td>
                                    <td style={{ padding: '10px' }}>{c.email || '-'}</td>
                                    <td style={{ padding: '10px' }}>{c.phone || '-'}</td>
                                    <td style={{ padding: '10px', color: c.is_active ? '#198754' : '#ef4444', fontWeight: 'bold' }}>
                                        {c.is_active ? 'Aktif' : 'Non-Aktif'}
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

export default CustomerListPage;
