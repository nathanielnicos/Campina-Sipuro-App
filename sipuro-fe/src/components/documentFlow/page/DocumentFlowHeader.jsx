import { useUploadDocumentFlow } from '../../../hooks/documentFlow/page/useUploadDocumentFlow';
import DocumentFlowImportModal from '../import-excel-modal/DocumentFlowImportModal'

const DocumentFlowHeader = ({
    activeTab,
    setActiveTab,
    currentUser,
    onSuccessSave
}) => {
    const currentUserId = currentUser?.id;
    const userDepartment = currentUser?.department;

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
    } = useUploadDocumentFlow({
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
                        onClick={() => setActiveTab('DELIVERY_ORDER')}
                        style={{
                            padding: '12px 20px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            borderBottom: activeTab === 'DELIVERY_ORDER' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'DELIVERY_ORDER' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Delivery Order
                    </button>
                    {userDepartment !== 'LOGISTIC' && (
                        <button
                            onClick={() => setActiveTab('SALES_INVOICE')}
                            style={{
                                padding: '12px 20px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                borderBottom: activeTab === 'SALES_INVOICE' ? '3px solid #0d6efd' : '3px solid transparent',
                                color: activeTab === 'SALES_INVOICE' ? '#0d6efd' : '#6c757d'
                            }}
                        >
                            Sales Invoice
                        </button>
                    )}
                </div>

                {userDepartment !== 'LOGISTIC' && (
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

            <DocumentFlowImportModal
                show={isPreviewOpen}
                parsedData={previewData}
                loading={saving}
                onConfirmImport={handleConfirmSave}
                onClose={handleRejectPreview}
            />
        </>
    );
};

export default DocumentFlowHeader;
