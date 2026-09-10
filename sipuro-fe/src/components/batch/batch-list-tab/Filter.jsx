const Filter = ({
    searchQuery,
    fromDate,
    toDate,
    batchStatus,
    currentUserRole,
    exporting,
    onSearchChange,
    onFromDateChange,
    onToDateChange,
    onStatusChange,
    onResetFilters,
    onExportExcel
}) => {
    const isFilterActive = Boolean(searchQuery || fromDate || toDate || batchStatus);

    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            alignItems: 'end'
        }}>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search Data</label>
                <input
                    type="text"
                    placeholder="Search Batch / Product / PO..."
                    value={searchQuery}
                    onChange={onSearchChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>From Planned Production Date</label>
                <input
                    type="date"
                    value={fromDate}
                    onChange={onFromDateChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>To Planned Production Date</label>
                <input
                    type="date"
                    value={toDate}
                    onChange={onToDateChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Batch Status</label>
                <select
                    value={batchStatus}
                    onChange={onStatusChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                >
                    <option value="">All Status</option>
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="Force Closed">Force Closed</option>
                    <option value="Canceled">Canceled</option>
                </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                        color: isFilterActive ? '#fff' : '#adb5bd',
                        border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                        borderRadius: '4px',
                        cursor: isFilterActive ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Reset
                </button>
                {currentUserRole !== 'CUSTOMER' && (
                    <button
                        onClick={onExportExcel}
                        disabled={exporting}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            backgroundColor: '#198754',
                            color: '#fff',
                            border: '1px solid #198754',
                            borderRadius: '4px',
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {exporting ? 'Downloading...' : 'Export Excel'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Filter;
