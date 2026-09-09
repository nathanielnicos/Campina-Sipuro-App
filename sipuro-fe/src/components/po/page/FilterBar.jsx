const FilterBar = ({
    search,
    startDate,
    endDate,
    status,
    isFilterActive,
    userRole,
    exporting,
    onSearchChange,
    onStartDateChange,
    onEndDateChange,
    onStatusChange,
    onResetFilters,
    onExportExcel,
    onCreateNewPO
}) => {
    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-end'
        }}>
            <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search PO Number</label>
                <input
                    type="text"
                    placeholder="Example: 001/PO/..."
                    value={search}
                    onChange={onSearchChange}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px' }}
                />
            </div>

            <div style={{ flex: '0 0 135px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>From Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={onStartDateChange}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '12px' }}
                />
            </div>

            <div style={{ flex: '0 0 135px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>To Date</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={onEndDateChange}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '12px' }}
                />
            </div>

            <div style={{ flex: '0 0 160px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>PO Status</label>
                <select
                    value={status}
                    onChange={onStatusChange}
                    style={{ width: '100%', padding: '7px 8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '12px' }}
                >
                    <option value="">All Status</option>
                    <option value="Waiting for Confirmation">Waiting for Confirmation</option>
                    <option value="Canceled">Canceled</option>
                    <option value="Waiting for Batch Assignment">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Production Completed</option>
                </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                        color: isFilterActive ? '#fff' : '#adb5bd',
                        border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                        borderRadius: '4px',
                        cursor: isFilterActive ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Reset Filters
                </button>

                {userRole !== 'PPIC' && (
                    <button
                        onClick={onExportExcel}
                        disabled={exporting}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                            opacity: exporting ? 0.7 : 1
                        }}
                    >
                        {exporting ? 'Exporting...' : '📊 Export Excel'}
                    </button>
                )}

                {userRole === 'CUSTOMER' && (
                    <button
                        onClick={onCreateNewPO}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        + Create PO
                    </button>
                )}
            </div>
        </div>
    );
};

export default FilterBar;
