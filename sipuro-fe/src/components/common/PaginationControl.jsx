const PaginationControl = ({
    pagination = { currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 },
    onPageChange,
    onLimitChange,
    limitOptions = [10, 25, 50]
}) => {
    const { currentPage, totalPages, totalItems, limit } = pagination;

    return (
        <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: '#f8f9fa',
            borderTop: '1px solid #dee2e6',
            gap: '16px'
        }}>
            {/* Sisi Kiri: Teks Informasi */}
            <div style={{ fontSize: '14px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                Showing <strong>{totalItems === 0 ? 0 : Math.min((currentPage - 1) * limit + 1, totalItems)}</strong>–
                <strong>{Math.min(currentPage * limit, totalItems)}</strong> of <strong>{totalItems}</strong> entries
            </div>

            {/* Sisi Kanan: Dropdown Tampilkan, Tombol Prev/Next */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginLeft: 'auto' }}>
                <div style={{ fontSize: '14px', color: '#6c757d', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <span>Show:</span>
                    <select
                        value={limit}
                        onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ced4da', backgroundColor: '#fff', cursor: 'pointer' }}
                    >
                        {limitOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange && onPageChange(currentPage - 1)}
                        style={{
                            padding: '6px 12px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            backgroundColor: currentPage <= 1 ? '#e9ecef' : '#fff',
                            color: currentPage <= 1 ? '#6c757d' : '#212529',
                            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        &laquo; Prev
                    </button>

                    <span style={{ fontSize: '14px', color: '#495057', margin: '0 4px', whiteSpace: 'nowrap' }}>
                        Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>
                    </span>

                    <button
                        disabled={currentPage >= totalPages || totalPages === 0}
                        onClick={() => onPageChange && onPageChange(currentPage + 1)}
                        style={{
                            padding: '6px 12px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            backgroundColor: (currentPage >= totalPages || totalPages === 0) ? '#e9ecef' : '#fff',
                            color: (currentPage >= totalPages || totalPages === 0) ? '#6c757d' : '#212529',
                            cursor: (currentPage >= totalPages || totalPages === 0) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Next &raquo;
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaginationControl;
