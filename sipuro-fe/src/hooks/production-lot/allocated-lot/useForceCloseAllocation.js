import { useState } from 'react';
import { forceCloseLotAllocationApi } from '../../../services/productionLotApi';
import { useGlobalModal } from '../../../context/ModalContext';
import { REASON_MAX_LENGTH } from './allocationQtyRules';

export const useForceCloseAllocation = (onRefresh) => {
    const { showConfirm, showAlert } = useGlobalModal();
    const [closing, setClosing] = useState(false);

    const executeForceClose = async (allocationId, reason) => {
        setClosing(true);
        try {
            const res = await forceCloseLotAllocationApi(allocationId, reason);
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Allocation force closed successfully.'
                });
                if (onRefresh) onRefresh();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res?.message || 'Failed to force close allocation.'
                });
            }
        } finally {
            setClosing(false);
        }
    };

    // Alasan wajib: memakai modal prompt global (validasi kosong dan panjang ada di ModalContext)
    const handleForceClose = (allocation) => {
        showConfirm({
            type: 'prompt',
            title: 'Force Close Allocation',
            message: `Force close the allocation of PO ${allocation.po_number} (Lot ${allocation.lot_number}, Batch ${allocation.batch_number})?`,
            inputLabel: `Reason (required, max ${REASON_MAX_LENGTH} characters)`,
            maxLength: REASON_MAX_LENGTH,
            confirmText: 'Force Close',
            isDanger: true,
            onConfirm: (reason) => executeForceClose(allocation.allocation_id, reason)
        });
    };

    return { closing, handleForceClose };
};

export default useForceCloseAllocation;
