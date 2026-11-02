import { useUploadDo } from '../../../hooks/do/import-modal/useUploadDo';
import ImportDoModal from '../import-modal/ImportDoModal';
import { usePermission } from '../../../context/PermissionContext';

const DoHeader = ({
    onSuccessSave
}) => {
    // Upload hanya untuk kelompok yang diberi izin "upload" pada menu DO (diatur di Access Permission)
    const { can } = usePermission();
    const canUpload = can('DO', 'upload');

    const {
        fileInputRef,
        uploading,
        previewData,
        isPreviewOpen,
        saving,
        handleUploadSubmit,
        handleConfirmSave,
        handleRejectPreview
    } = useUploadDo({ onSuccessSave });

    return (
        <>
            {canUpload && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    marginBottom: '20px'
                }}>
                    <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '0px' }}>
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
                            {uploading ? 'Processing Excel...' : 'Upload Delivery Order'}
                        </button>
                    </form>
                </div>
            )}

            <ImportDoModal
                show={isPreviewOpen}
                parsedData={previewData}
                loading={saving}
                onConfirmImport={handleConfirmSave}
                onClose={handleRejectPreview}
            />
        </>
    );
};

export default DoHeader;
