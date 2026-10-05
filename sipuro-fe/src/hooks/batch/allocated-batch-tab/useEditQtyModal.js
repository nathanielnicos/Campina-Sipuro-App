import { useState } from 'react';
import { updateAllocationQtyApi } from '../../../services/batchApi';
import { useGlobalModal } from '../../../context/ModalContext';
import { formatQty } from '../../../utils/formatters';

export const useEditQtyModal = (currentUser, onRefresh) => {
    const { showConfirm, showAlert } = useGlobalModal();

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [editLoading, setEditLoading] = useState(false);

    const handleOpenEditQty = (allocationRow) => {
        setSelectedAllocation(allocationRow);
        setIsEditModalOpen(true);
    };

    const handleCloseEditQty = () => {
        setSelectedAllocation(null);
        setIsEditModalOpen(false);
    };

    const executeSaveQty = async (allocationId, newAllocatedQty, reason = '') => {
        setEditLoading(true);
        try {
            const userId = currentUser?.id || null;
            const res = await updateAllocationQtyApi(allocationId, {
                newAllocatedQty,
                reason,
                userId
            });
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Allocated quantity updated successfully.'
                });
                handleCloseEditQty();
                if (onRefresh) onRefresh();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res?.message || 'Failed to update allocated quantity.'
                });
            }
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'A system error occurred while updating allocated quantity.'
            });
        } finally {
            setEditLoading(false);
        }
    };

    const handleSaveQty = (allocationId, newAllocatedQty, reason) => {
        showConfirm({
            title: 'Update Allocated Quantity',
            message: `Are you sure you want to update allocated quantity to ${formatQty(newAllocatedQty)}?`,
            confirmText: 'Save Changes',
            onConfirm: () => executeSaveQty(allocationId, newAllocatedQty, reason)
        });
    };

    return {
        isEditModalOpen,
        selectedAllocation,
        editLoading,
        handleOpenEditQty,
        handleCloseEditQty,
        handleSaveQty
    };
};

export default useEditQtyModal;
