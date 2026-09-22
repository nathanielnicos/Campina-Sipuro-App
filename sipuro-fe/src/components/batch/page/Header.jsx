import { useUploadProduction } from '../../../hooks/batch/page/useUploadProduction';
import ImportExcelModal from '../import-excel-modal/ImportExcelModal';

const Header = ({
    activeTab,
    onTabChange,
    currentUser,
    onSuccessSave
}) => {
    const currentUserId = currentUser?.employee_id || currentUser?.id;
    const userRole = currentUser?.role;

    // Encapsulation: Hook dipanggil langsung di komponen Header yang mengontrol form upload & modal
    const {
        fileInputRef,
        uploading,
        previewData,
        isPreviewOpen,
        saving,
        handleUploadSubmit,
        handleConfirmSave,
        handleRejectPreview
    } = useUploadProduction({
        currentUserId,
        onSuccessSave
    });

    return (
        <>
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
                        Outstanding
                    </button>
                    <button
                        onClick={() => onTabChange('mapping')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'mapping' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'mapping' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Allocated Batch
                    </button>
                </div>

                {userRole !== 'CUSTOMER' && (
                    <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '6px' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls"
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

            <ImportExcelModal
                show={isPreviewOpen}
                parsedData={previewData}
                loading={saving}
                onConfirmImport={handleConfirmSave}
                onClose={handleRejectPreview}
            />
        </>
    );
};

export default Header;
