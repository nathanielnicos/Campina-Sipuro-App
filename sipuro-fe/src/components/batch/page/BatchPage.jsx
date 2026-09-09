import Header from './Header';
import UnbatchedTable from '../unbatched-tab/UnbatchedTable';
import BatchListTable from '../batch-list-tab/BatchListTable';
import OverproductionTable from '../overproduction-tab/OverproductionTable';
import ImportExcelModal from '../import-excel-modal/ImportExcelModal';

// Custom Hooks
import { useBatchPage } from '../../../hooks/batch/page/useBatchPage';
import { useUploadProduction } from '../../../hooks/batch/page/useUploadProduction';

const BatchPage = ({ currentUser }) => {
    const currentUserId = currentUser?.employee_id || currentUser?.id;

    // 1. Hook Utama Halaman Batch
    const {
        reloadTrigger,
        activeTab,
        loading,
        setActiveTab,
        handleTriggerReload,
        handleUpdateStatus
    } = useBatchPage();

    // 2. Hook Fitur Upload Production
    const {
        fileInputRef,
        uploading,
        previewData,
        isPreviewOpen,
        saving,
        setUploadFile,
        handleUploadSubmit,
        handleConfirmSave,
        handleRejectPreview
    } = useUploadProduction({
        currentUserId,
        onSuccessSave: handleTriggerReload
    });

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <Header
                activeTab={activeTab}
                onTabChange={setActiveTab}
                userRole={currentUser?.role}
                fileInputRef={fileInputRef}
                uploading={uploading}
                onFileChange={(e) => setUploadFile(e.target.files[0] || null)}
                onUploadSubmit={handleUploadSubmit}
            />

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
                    <UnbatchedTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}

                {activeTab === 'mapping' && (
                    <BatchListTable
                        currentUser={currentUser}
                        onUpdateStatus={handleUpdateStatus}
                        reloadTrigger={reloadTrigger}
                    />
                )}

                {activeTab === 'unallocated' && (
                    <OverproductionTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}
            </div>

            <ImportExcelModal
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
