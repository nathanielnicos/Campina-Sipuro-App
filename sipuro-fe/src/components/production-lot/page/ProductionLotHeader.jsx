import { useUploadProductionLot } from '../../../hooks/production-lot/import-modal/useUploadProductionLot';
import ImportProductionLotModal from '../import-modal/ImportProductionLotModal';
import RebalanceAllocationModal from '../allocated-lot/RebalanceAllocationModal';
import useRebalanceAllocation from '../../../hooks/production-lot/allocated-lot/useRebalanceAllocation';
import { usePermission } from '../../../context/PermissionContext';

const ProductionLotHeader = ({ onSuccessSave }) => {
    const { can } = usePermission();
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
    } = useUploadProductionLot({ onSuccessSave });
    // Rebalance sejajar dengan upload; setelah commit, tabel dimuat ulang lewat pemicu halaman (onSuccessSave)
    const rebalance = useRebalanceAllocation(onSuccessSave);

    return (
        <>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <div>
                    {can('PRODUCTION_LOT', 'update') && (
                        <button
                            type="button"
                            onClick={rebalance.handleOpen}
                            title="Fill older PO items first by moving later lot allocations forward"
                            style={{ padding: '6px 14px', border: '1px solid #0d6efd', borderRadius: '4px', backgroundColor: '#fff', color: '#0d6efd', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Rebalance Allocation
                        </button>
                    )}
                </div>
                {can('PRODUCTION_LOT', 'upload') && (
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
                        {uploading ? 'Processing Excel...' : 'Upload Production Lot'}
                    </button>
                </form>
                )}
            </div>

            <RebalanceAllocationModal
                isOpen={rebalance.isOpen}
                onClose={rebalance.handleClose}
                products={rebalance.products}
                productId={rebalance.productId}
                onProductChange={rebalance.handleProductChange}
                preview={rebalance.preview}
                reason={rebalance.reason}
                onReasonChange={rebalance.setReason}
                reasonMaxLength={rebalance.reasonMaxLength}
                error={rebalance.error}
                loadingProducts={rebalance.loadingProducts}
                previewing={rebalance.previewing}
                saving={rebalance.saving}
                onPreview={rebalance.handlePreview}
                onCommit={rebalance.handleCommit}
            />

            <ImportProductionLotModal
                show={isPreviewOpen}
                parsedData={previewData}
                loading={saving}
                onConfirmImport={handleConfirmSave}
                onClose={handleRejectPreview}
            />
        </>
    );
};

export default ProductionLotHeader;
