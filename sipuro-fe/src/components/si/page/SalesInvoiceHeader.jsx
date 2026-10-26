import React from 'react';
import { useUploadSi } from '../../../hooks/si/useUploadSi';
import ImportSiModal from '../import-modal/ImportSiModal';

const SalesInvoiceHeader = ({ currentUser, onSuccessSave }) => {
    const currentUserId = currentUser?.id;
    const userRole = currentUser?.role;

    const {
        fileInputRef,
        uploading,
        previewData,
        isPreviewOpen,
        saving,
        handleUploadSubmit,
        handleConfirmSave,
        handleRejectPreview
    } = useUploadSi({ currentUserId, onSuccessSave });

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px' }}>
                {userRole !== 'CUSTOMER' && (
                    <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                        <input ref={fileInputRef} type="file" accept=".xlsx, .xls" style={{ fontSize: '12px' }} />
                        <button type="submit" disabled={uploading} style={{ padding: '6px 12px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                            {uploading ? 'Processing Excel...' : 'Upload Sales Invoice'}
                        </button>
                    </form>
                )}
            </div>

            <ImportSiModal
                show={isPreviewOpen}
                parsedData={previewData}
                loading={saving}
                onConfirmImport={handleConfirmSave}
                onClose={handleRejectPreview}
            />
        </>
    );
};

export default SalesInvoiceHeader;
