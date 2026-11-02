import Button from '../../common/Button';
import { PO_STATUS } from '../../../constants/po';

const PODActions = ({ poId, canWrite, canCancel, canReview, poStatus, loading, onClose, onCancel, onUpdateStatus }) => {
    const isAnyLoading = Boolean(loading);

    const isDraftOrNew = !poId || poStatus === PO_STATUS.DRAFT;
    const isWaiting = poStatus === PO_STATUS.WAITING;

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
            <div>
                {/* Tombol Cancel PO aktif saat Waiting for Confirmation ATAU Draft */}
                {poId && canCancel && (isWaiting || poStatus === PO_STATUS.DRAFT) && (
                    <Button variant="danger" onClick={onCancel} disabled={isAnyLoading}>
                        {loading === 'CANCEL' ? 'Cancelling...' : 'Cancel PO'}
                    </Button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="secondary" onClick={onClose} disabled={isAnyLoading}>
                    Close
                </Button>

                {/* Approve & Reject hanya untuk pemilik izin approve saat Waiting for Confirmation */}
                {poId && canReview && isWaiting && (
                    <>
                        <Button
                            variant="danger"
                            disabled={isAnyLoading}
                            onClick={() => onUpdateStatus(PO_STATUS.REJECTED)}
                        >
                            {loading === 'REJECT' ? 'Rejecting...' : 'Reject PO'}
                        </Button>
                        <Button
                            variant="success"
                            disabled={isAnyLoading}
                            onClick={() => onUpdateStatus(PO_STATUS.APPROVED)}
                        >
                            {loading === 'APPROVE' ? 'Approving...' : 'Approve PO'}
                        </Button>
                    </>
                )}

                {/* Tombol untuk pengguna berizin saat pembuatan baru/Draft */}
                {canWrite && isDraftOrNew && (
                    <>
                        {/* Tombol Save as Draft */}
                        <Button
                            type="submit"
                            variant="purple"
                            name="target_status"
                            value={PO_STATUS.DRAFT}
                            disabled={isAnyLoading}
                        >
                            {loading === 'SAVE_DRAFT' ? 'Saving Draft...' : 'Save as Draft'}
                        </Button>

                        {/* Tombol Submit PO (Mengubah status menjadi Waiting for Confirmation) */}
                        <Button
                            type="submit"
                            variant="primary"
                            name="target_status"
                            value={PO_STATUS.WAITING}
                            disabled={isAnyLoading}
                        >
                            {loading === 'SUBMIT' ? 'Submitting...' : 'Submit PO'}
                        </Button>
                    </>
                )}

                {/* Tombol Save Changes untuk pengguna berizin jika PO sudah posisi Waiting for Confirmation */}
                {canWrite && poId && isWaiting && (
                    <Button type="submit" variant="primary" disabled={isAnyLoading}>
                        {loading === 'SAVE' ? 'Saving...' : 'Save Changes'}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default PODActions;
