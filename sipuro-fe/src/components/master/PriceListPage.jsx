import { usePriceList } from '../../hooks/master/usePriceList';
import UploadPreviewModal from './UploadPreviewModal';
import PaginationControl from '../common/PaginationControl';
import { formatDate } from '../../utils/formatters';

const PriceListPage = () => {
    const {
        prices,
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
        handlePreviewPrices,
        handleConfirmCommit,
        handlePageChange,
        handleLimitChange,
        closePreviewModal
    } = usePriceList();

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

                <form onSubmit={handlePreviewPrices} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        {uploading ? 'Processing...' : 'Upload & Preview Prices'}
                    </button>
                </form>
            </div>

            {loadingData ? (
                <div>Loading price data...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Product Code</th>
                                    <th style={{ padding: '10px' }}>Product Name</th>
                                    <th style={{ padding: '10px' }}>Selling Price</th>
                                    <th style={{ padding: '10px' }}>Effective Date</th>
                                    <th style={{ padding: '10px' }}>Expiry Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prices.length === 0 ? (
                                    <tr><td colSpan="5" style={{ padding: '15px', textAlign: 'center' }}>No price data available</td></tr>
                                ) : (
                                    prices.map((pr) => (
                                        <tr key={pr.price_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{pr.product_code || '-'}</td>
                                            <td style={{ padding: '10px' }}>{pr.product_name || '-'}</td>
                                            <td style={{ padding: '10px' }}>Rp {Number(pr.price).toLocaleString('id-ID')}</td>
                                            <td style={{ padding: '10px' }}>{formatDate(pr.start_date)}</td>
                                            <td style={{ padding: '10px' }}>{pr.end_date ? formatDate(pr.end_date) : 'Ongoing'}</td>
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

export default PriceListPage;
