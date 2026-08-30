import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { previewPricesApi, commitPricesApi } from '../../services/masterUploadApi';
import UploadPreviewModal from './UploadPreviewModal';

const PriceListPage = () => {
    const [prices, setPrices] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewModal, setPreviewModal] = useState({ open: false, title: '', data: null });

    useEffect(() => {
        fetchPrices();
    }, []);

    const fetchPrices = async () => {
        try {
            const res = await axios.get('/api/product-prices');
            setPrices(res.data.data || res.data);
        } catch (err) {
            console.error('Gagal mengambil data harga:', err);
        } finally {
            setLoadingData(false);
        }
    };

    const handlePreviewPrices = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert('Pilih file Excel terlebih dahulu.');
        setUploading(true);
        try {
            const res = await previewPricesApi(selectedFile);
            if (res.success) {
                setPreviewModal({ open: true, title: 'Daftar Harga Jual Produk', data: res });
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal memproses preview Excel Harga.');
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmCommit = async (items) => {
        try {
            const res = await commitPricesApi(items);
            if (res.success) {
                alert(res.message);
                setPreviewModal({ open: false, title: '', data: null });
                setSelectedFile(null);
                fetchPrices();
            }
        } catch (err) {
            alert('Gagal menyimpan data ke database.');
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Daftar Harga Jual Produk</h3>
                <form onSubmit={handlePreviewPrices} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        required
                        style={{ fontSize: '12px' }}
                    />
                    <button
                        type="submit"
                        disabled={uploading}
                        style={{ padding: '6px 12px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                    >
                        {uploading ? 'Memproses...' : 'Upload & Preview Harga'}
                    </button>
                </form>
            </div>

            {loadingData ? (
                <div>Memuat data harga...</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>Kode Produk</th>
                            <th style={{ padding: '10px' }}>Nama Produk</th>
                            <th style={{ padding: '10px' }}>Harga Jual</th>
                            <th style={{ padding: '10px' }}>Mulai Berlaku</th>
                            <th style={{ padding: '10px' }}>Selesai Berlaku</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prices.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data harga</td></tr>
                        ) : (
                            prices.map((pr) => (
                                <tr key={pr.price_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{pr.product_code || pr.id_product}</td>
                                    <td style={{ padding: '10px' }}>{pr.product_name || '-'}</td>
                                    <td style={{ padding: '10px' }}>Rp {Number(pr.price).toLocaleString('id-ID')}</td>
                                    <td style={{ padding: '10px' }}>{pr.start_date ? new Date(pr.start_date).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ padding: '10px' }}>{pr.end_date ? new Date(pr.end_date).toLocaleDateString('id-ID') : 'Seterusnya'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}

            {previewModal.open && (
                <UploadPreviewModal
                    title={previewModal.title}
                    previewData={previewModal.data}
                    onClose={() => setPreviewModal({ open: false, title: '', data: null })}
                    onConfirm={handleConfirmCommit}
                />
            )}
        </div>
    );
};

export default PriceListPage;
