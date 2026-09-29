import { useProductList } from '../../hooks/master/useProductList';
import UploadPreviewModal from './UploadPreviewModal';
import PaginationControl from '../common/PaginationControl';

const formatDecimal = (val) => {
    if (val === null || val === undefined || val === '' || val === '-') return '-';
    const num = Number(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString('id-ID');
};

const ProductListPage = () => {
    const {
        products,
        loadingData,
        setSelectedFile,
        uploading,
        previewModal,
        search,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        handleSearchChange,
        handleResetFilter,
        handlePreviewProducts,
        handleConfirmCommit,
        handlePageChange,
        handleLimitChange,
        closePreviewModal
    } = useProductList();

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
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
                            Search Code / Product Name
                        </label>
                        <input
                            type="text"
                            placeholder="Search product code or name..."
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
                        style={{ fontSize: '12px' }}
                    />
                    <button
                        type="submit"
                        disabled={uploading}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: '#198754',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            opacity: uploading ? 0.6 : 1,
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        {uploading ? 'Processing...' : 'Upload & Preview Products'}
                    </button>
                </form>
            </div>

            {loadingData ? (
                <div>Loading product data...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Product Code</th>
                                    <th style={{ padding: '10px' }}>Product Name</th>
                                    <th style={{ padding: '10px' }}>Base UOM</th>
                                    <th style={{ padding: '10px' }}>PCS / CTN</th>
                                    <th style={{ padding: '10px' }}>CTN / PLT</th>
                                    <th style={{ padding: '10px' }}>ML / PCS</th>
                                    <th style={{ padding: '10px' }}>KG / PCS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '15px', textAlign: 'center' }}>No product data available</td></tr>
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
                    onClose={closePreviewModal}
                    onConfirm={handleConfirmCommit}
                    isCommitting={uploading}
                />
            )}
        </div>
    );
};

export default ProductListPage;
