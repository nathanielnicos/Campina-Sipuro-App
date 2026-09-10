const Filter = ({
    searchProduct,
    searchPo,
    fromCreatedDate,
    toCreatedDate,
    onProductChange,
    onPoChange,
    onFromDateChange,
    onToDateChange,
    onResetFilters
}) => {
    const isFilterActive = Boolean(searchProduct || searchPo || fromCreatedDate || toCreatedDate);

    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            alignItems: 'end'
        }}>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    Search Product Code/Name
                </label>
                <input
                    type="text"
                    placeholder="Example: FG-CN-00060"
                    value={searchProduct}
                    onChange={onProductChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    Search PO Number
                </label>
                <input
                    type="text"
                    placeholder="Example: PO-20260824-895"
                    value={searchPo}
                    onChange={onPoChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    From Created Date
                </label>
                <input
                    type="date"
                    value={fromCreatedDate}
                    onChange={onFromDateChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    To Created Date
                </label>
                <input
                    type="date"
                    value={toCreatedDate}
                    onChange={onToDateChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                />
            </div>
            <div>
                <button
                    onClick={onResetFilters}
                    disabled={!isFilterActive}
                    style={{
                        width: '100%',
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
                    Reset Filters
                </button>
            </div>
        </div>
    );
};

export default Filter;
