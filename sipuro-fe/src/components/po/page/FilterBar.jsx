import DateRangePicker from '../../common/DateRangePicker';

const FilterBar = ({
    search,
    startDate,
    endDate,
    deliveryStartDate,
    deliveryEndDate,
    status,
    isFilterActive,
    userRole,
    exporting,
    onSearchChange,
    onStartDateChange,
    onEndDateChange,
    onDeliveryStartDateChange,
    onDeliveryEndDateChange,
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
            {/* Search Input */}
            <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search PO Number</label>
                <input
                    type="text"
                    placeholder="Example: 001/PO/..."
                    value={search}
                    onChange={onSearchChange}
                    style={{
                        width: '100%',
                        height: '38px',
                        padding: '7px 10px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        boxSizing: 'border-box',
                        fontSize: '13px'
                    }}
                />
            </div>

            {/* Created Date Range Picker */}
            <div style={{ flex: '0 0 220px' }}>
                <DateRangePicker
                    label="Filter Created Date"
                    fromDate={startDate}
                    toDate={endDate}
                    onFromDateChange={onStartDateChange}
                    onToDateChange={onEndDateChange}
                />
            </div>

            {/* Req. Delivery Date Range Picker */}
            <div style={{ flex: '0 0 220px' }}>
                <DateRangePicker
                    label="Filter Delivery Date"
                    fromDate={deliveryStartDate}
                    toDate={deliveryEndDate}
                    onFromDateChange={onDeliveryStartDateChange}
                    onToDateChange={onDeliveryEndDateChange}
                />
            </div>

            {/* PO Status Select */}
            <div style={{ flex: '0 0 160px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>PO Status</label>
                <select
                    value={status}
                    onChange={onStatusChange}
                    style={{
                        width: '100%',
                        height: '38px',
                        padding: '7px 8px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        boxSizing: 'border-box',
                        fontSize: '12px'
                    }}
                >
                    <option value="">All Status</option>
                    <option value="Waiting for Confirmation">Waiting for Confirmation</option>
                    <option value="Canceled">Canceled</option>
                    <option value="Waiting for Batch Assignment">{userRole === 'CUSTOMER' ? 'Approved' : 'Waiting for Batch Assignment'}</option>
                    <option value="Rejected">Rejected</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Production Completed</option>
                </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        padding: '8px 12px',
                        height: '38px',
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

                {userRole === 'CUSTOMER' && (
                    <button
                        onClick={onExportExcel}
                        disabled={exporting}
                        style={{
                            padding: '8px 12px',
                            height: '38px',
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
                            height: '38px',
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
