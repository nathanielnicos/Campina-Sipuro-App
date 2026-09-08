import { useState, useRef } from 'react';
import {
    updateAllocationStatusApi
} from '../../services/batchApi';
import {
    previewProductionApi,
    confirmProductionApi
} from '../../services/productionUploadApi';

import PendingSkuTable from './PendingSkuTable';
import BatchMappingTable from './BatchMappingTable';
import UnallocatedStockTable from './UnallocatedStockTable';
import ProductionPreviewModal from './ProductionPreviewModal';

const BatchPage = ({ currentUser }) => {
    const currentUserId = currentUser?.employee_id || currentUser?.id;
    const fileInputRef = useRef(null);

    const [reloadTrigger, setReloadTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(false);

    // Modals & Upload State
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // State previewData menyimpan data kalkulasi tunggal dari backend
    const [previewData, setPreviewData] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Helper untuk memicu reload ke semua tab anak jika ada aksi global
    const handleTriggerReload = () => {
        setReloadTrigger(prev => prev + 1);
    };

    // Proses Upload Excel (Single API Hit)
    const processExcelUpload = async (fileToUpload) => {
        const actualFile = fileToUpload || (fileInputRef.current && fileInputRef.current.files[0]);

        if (!actualFile) return alert('Please select an Excel file first!');

        const formData = new FormData();
        formData.append('file', actualFile);

        setUploading(true);

        try {
            const res = await previewProductionApi(formData);
            setUploading(false);

            if (res && res.success) {
                setPreviewData(res.data);
                setIsPreviewOpen(true);
            } else {
                alert('Upload failed: ' + (res?.message || 'Failed to process file.'));
            }
        } catch (err) {
            setUploading(false);
            alert('An error occurred while uploading the file.');
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        await processExcelUpload(uploadFile);
    };

    const handleConfirmSave = async (modalPayload = {}) => {
        if (!previewData) return;

        const newDetailsCount = modalPayload.newDetails ? modalPayload.newDetails.length : 0;

        const confirmMsg = previewData.isReupload
            ? `${previewData.warningMessage}\nAre you sure you want to resave this production allocation?`
            : `Save ${newDetailsCount} new row(s) to the database?`;

        if (!window.confirm(confirmMsg)) return;

        setSaving(true);
        const payload = {
            processTimestamp: previewData.processTimestamp,
            fileHash: previewData.fileHash,
            fileName: previewData.fileName,
            userId: currentUserId,
            allocations: previewData.detailedAllocations || [],
            unallocatedStocks: previewData.unallocatedStocks || [],
            newDetails: modalPayload.newDetails || []
        };

        const res = await confirmProductionApi(payload);
        setSaving(false);

        if (res && res.success) {
            alert(res.message || 'Successfully saved!');
            handleResetUploadState();
            handleTriggerReload(); // Trigger reload data ke komponen anak
        } else {
            alert('Save failed: ' + (res?.message || 'An error occurred.'));
        }
    };

    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        setUploadFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRejectPreview = () => {
        handleResetUploadState();
    };

    const handleUpdateStatus = async (allocationId, action) => {
        const actionText = action === 'CANCEL' ? 'cancel' : 'force close';

        const reason = window.prompt(`Are you sure you want to ${actionText} this batch allocation?\nEnter reason (optional):`);

        if (reason === null) return;

        setLoading(true);
        try {
            const res = await updateAllocationStatusApi(allocationId, { action, reason });
            if (res && res.success) {
                alert(res.message || 'Allocation status updated successfully.');
                handleTriggerReload(); // Trigger reload data ke komponen anak
            } else {
                alert('Failed: ' + (res?.message || 'Failed to update allocation status.'));
            }
        } catch (err) {
            alert('A system error occurred while updating the status.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #dee2e6',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={() => setActiveTab('summary')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'summary' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'summary' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Unbatched
                    </button>
                    <button
                        onClick={() => setActiveTab('mapping')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'mapping' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'mapping' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Batch List
                    </button>
                    <button
                        onClick={() => setActiveTab('unallocated')}
                        style={{
                            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                            borderBottom: activeTab === 'unallocated' ? '3px solid #0d6efd' : '3px solid transparent',
                            color: activeTab === 'unallocated' ? '#0d6efd' : '#6c757d'
                        }}
                    >
                        Overproduction
                    </button>
                </div>

                <form onSubmit={handleUploadSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '6px' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => setUploadFile(e.target.files[0] || null)}
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
            </div>

            <div style={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 10,
                        fontSize: '12px',
                        color: '#0d6efd',
                        fontWeight: 'bold',
                        zIndex: 10
                    }}>
                        Loading data...
                    </div>
                )}

                {activeTab === 'summary' && (
                    <PendingSkuTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}

                {activeTab === 'mapping' && (
                    <BatchMappingTable
                        onUpdateStatus={handleUpdateStatus}
                        reloadTrigger={reloadTrigger}
                    />
                )}

                {activeTab === 'unallocated' && (
                    <UnallocatedStockTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}
            </div>

            <ProductionPreviewModal
                isOpen={isPreviewOpen}
                previewData={previewData}
                saving={saving}
                onConfirmSave={handleConfirmSave}
                onRejectPreview={handleRejectPreview}
            />
        </div>
    );
};

export default BatchPage;
