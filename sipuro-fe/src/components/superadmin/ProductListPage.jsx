import { useState, useEffect, useCallback } from 'react';
import { getProducts } from '../../services/superadminApi';
import { previewProductsApi, commitProductsApi } from '../../services/masterUploadApi';
import UploadPreviewModal from './UploadPreviewModal';
import PaginationControl from '../common/PaginationControl';

// Helper untuk menghilangkan 0 di belakang koma (contoh: 12.340000 -> 12.34, 10.000000 -> 10)
const formatDecimal = (val) => {
    if (val === null || val === undefined || val === '' || val === '-') return '-';
    const num = Number(val);
    if (isNaN(num)) return '-';
    return String(num); // Standard String conversion JavaScript otomatis membuang trailing zeros
};

const ProductListPage = () => {
    const [products, setProducts] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewModal, setPreviewModal] = useState({ open: false, title: '', data: null });

    // State Filter & Search
    const [search, setSearch] = useState('');

    // State Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchProductsData = useCallback(async () => {
        try {
            setLoadingData(true);
            const res = await getProducts(currentPage, pageSize, search);
            if (res.success) {
                setProducts(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            console.error('Gagal mengambil data produk:', err);
        } finally {
            setLoadingData(false);
        }
    }, [currentPage, pageSize, search]);

    useEffect(() => {
        fetchProductsData();
    }, [fetchProductsData]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilter = () => {
        setSearch('');
        setCurrentPage(1);
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
            const savedUser = localStorage.getItem('sipuro_user');
            const currentUser = savedUser ? JSON.parse(savedUser) : null;
            const createdBy = currentUser?.code || currentUser?.username || 'SYSTEM';

            const res = await commitProductsApi(items, createdBy);
            if (res.success) {
                alert(res.message);
                setPreviewModal({ open: false, title: '', data: null });
                setSelectedFile(null);
                fetchProductsData();
            }
        } catch (err) {
            alert('Gagal menyimpan data ke database.');
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleLimitChange = (newLimit) => {
        setPageSize(newLimit);
        setCurrentPage(1);
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            {/* Header Form Filter & Upload */}
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ minWidth: '220px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            Cari Kode / Nama Produk
                        </label>
                        <input
                            type="text"
                            placeholder="Cari Kode atau Nama Produk..."
                            value={search}
                            onChange={handleSearchChange}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px' }}
                        />
                    </div>
                    {search && (
                        <button
                            onClick={handleResetFilter}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: '#dc3545',
                                color: '#fff',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px'
                            }}
                        >
                            Reset Filter
                        </button>
                    )}
                </div>

                <form onSubmit={handlePreviewProducts} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
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
                                            <td style={{ padding: '10px' }}>{formatDecimal(p.ml_per_pcs)}</td>
                                            <td style={{ padding: '10px' }}>{formatDecimal(p.kg_per_pcs)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControl
                        pagination={{
                            currentPage,
                            totalPages,
                            totalItems,
                            limit: pageSize
                        }}
                        onPageChange={handlePageChange}
                        onLimitChange={handleLimitChange}
                    />
                </div>
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
