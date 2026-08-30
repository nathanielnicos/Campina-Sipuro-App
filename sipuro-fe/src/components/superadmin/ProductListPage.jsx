import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { previewProductsApi, commitProductsApi } from '../../services/masterUploadApi';
import UploadPreviewModal from './UploadPreviewModal';

const ProductListPage = () => {
    const [products, setProducts] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewModal, setPreviewModal] = useState({ open: false, title: '', data: null });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data.data || res.data);
        } catch (err) {
            console.error('Gagal mengambil data produk:', err);
        } finally {
            setLoadingData(false);
        }
    };

    const handlePreviewProducts = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert('Pilih file Excel terlebih dahulu.');
        setUploading(true);
        try {
            const res = await previewProductsApi(selectedFile);
            if (res.success) {
                setPreviewModal({ open: true, title: 'Daftar Produk Master SKU', data: res });
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal memproses preview Excel Produk.');
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmCommit = async (items) => {
        try {
            const res = await commitProductsApi(items);
            if (res.success) {
                alert(res.message);
                setPreviewModal({ open: false, title: '', data: null });
                setSelectedFile(null);
                fetchProducts();
            }
        } catch (err) {
            alert('Gagal menyimpan data ke database.');
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Daftar Produk (Master SKU)</h3>
                <form onSubmit={handlePreviewProducts} style={{ display: 'flex', gap: '8px' }}>
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
                        {uploading ? 'Memproses...' : 'Upload & Preview Produk'}
                    </button>
                </form>
            </div>

            {loadingData ? (
                <div>Memuat data produk...</div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>Kode Produk</th>
                            <th style={{ padding: '10px' }}>Nama Produk</th>
                            <th style={{ padding: '10px' }}>Base UOM</th>
                            <th style={{ padding: '10px' }}>PCS / CTN</th>
                            <th style={{ padding: '10px' }}>CTN / PLT</th>
                            <th style={{ padding: '10px' }}>ML / PCS</th>
                            <th style={{ padding: '10px' }}>KG / PCS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.length === 0 ? (
                            <tr><td colSpan="7" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data produk</td></tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.id_product} style={{ borderBottom: '1px solid #e9ecef' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.product_code}</td>
                                    <td style={{ padding: '10px' }}>{p.product_name}</td>
                                    <td style={{ padding: '10px' }}>{p.base_uom}</td>
                                    <td style={{ padding: '10px' }}>{p.pcs_per_ctn}</td>
                                    <td style={{ padding: '10px' }}>{p.ctn_per_plt}</td>
                                    <td style={{ padding: '10px' }}>{p.ml_per_pcs}</td>
                                    <td style={{ padding: '10px' }}>{p.kg_per_pcs}</td>
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

export default ProductListPage;
