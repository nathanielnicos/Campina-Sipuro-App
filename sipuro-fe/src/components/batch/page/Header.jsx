const Header = ({
    activeTab,
    onTabChange,
    userRole,
    fileInputRef,
    uploading,
    onFileChange,
    onUploadSubmit
}) => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #dee2e6',
            marginBottom: '20px'
        }}>
            <div style={{ display: 'flex' }}>
                <button
                    onClick={() => onTabChange('summary')}
                    style={{
                        padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                        borderBottom: activeTab === 'summary' ? '3px solid #0d6efd' : '3px solid transparent',
                        color: activeTab === 'summary' ? '#0d6efd' : '#6c757d'
                    }}
                >
                    Unbatched
                </button>
                <button
                    onClick={() => onTabChange('mapping')}
                    style={{
                        padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                        borderBottom: activeTab === 'mapping' ? '3px solid #0d6efd' : '3px solid transparent',
                        color: activeTab === 'mapping' ? '#0d6efd' : '#6c757d'
                    }}
                >
                    Batch List
                </button>
                {userRole !== 'CUSTOMER' && (
                    <button
                        onClick={() => onTabChange('unallocated')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'unallocated' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'unallocated' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Overproduction
                    </button>
                )}
            </div>

            {userRole !== 'CUSTOMER' && (
                <form onSubmit={onUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '6px' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={onFileChange}
                        style={{ fontSize: '12px' }}
                    />
                    <button
                        type="submit"
                        disabled={uploading}
                        style={{ padding: '6px 12px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                        {uploading ? 'Processing Excel...' : 'Upload Production'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default Header;
