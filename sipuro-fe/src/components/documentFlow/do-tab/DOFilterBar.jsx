import DateRangePicker from '../../common/DateRangePicker';

const DOFilterBar = ({
    search,
    startDate,
    endDate,
    pickUpStartDate,
    pickUpEndDate,
    isFilterActive,
    onSearchChange,
    onStartDateChange,
    onEndDateChange,
    onPickUpStartDateChange,
    onPickUpEndDateChange,
    onResetFilters
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
            <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    Search
                </label>
                <input
                    type="text"
                    placeholder="PO No, DO No, Item Code, Item Name..."
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

            {/* DO Created Date */}
            <div style={{ flex: '0 0 220px' }}>
                <DateRangePicker
                    label="Filter DO Created Date"
                    fromDate={startDate}
                    toDate={endDate}
                    onFromDateChange={onStartDateChange}
                    onToDateChange={onEndDateChange}
                />
            </div>

            {/* Pick Up Date */}
            <div style={{ flex: '0 0 220px' }}>
                <DateRangePicker
                    label="Filter Pick Up Date"
                    fromDate={pickUpStartDate}
                    toDate={pickUpEndDate}
                    onFromDateChange={onPickUpStartDateChange}
                    onToDateChange={onPickUpEndDateChange}
                />
            </div>

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
            </div>
        </div>
    );
};

export default DOFilterBar;
