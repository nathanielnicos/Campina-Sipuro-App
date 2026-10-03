import { useState } from 'react';
import { savePO, cancelPOApi, updatePOStatusApi } from '../../../services/poApi';
import { useGlobalModal } from '../../../context/ModalContext';

export const useActions = ({ poId, currentUser, onSuccess }) => {
    // Simpan jenis aksi yang sedang loading: 'SAVE', 'SAVE_DRAFT', 'SUBMIT', 'CANCEL', 'APPROVE', 'REJECT', atau null
    const [actionLoading, setActionLoading] = useState(null);

    // Akses fungsi modal global
    const { showConfirm, showAlert } = useGlobalModal();

    const userRole = currentUser?.role;
    const customerUserId = userRole === 'CUSTOMER' ? currentUser?.id : null;
    const employeeId = userRole !== 'CUSTOMER' ? currentUser?.id : null;

    // Fungsi internal untuk eksekusi API Save/Submit PO
    const executeSavePO = async (targetStatus, formData, loadingType) => {
        const { deliveryAddress, description, subtotal, taxAmount, grandTotal, items, customerId, poStatus } = formData;

        const payload = {
            customer_id: customerId,
            status: targetStatus,
            ...(poId ? { updated_by: customerUserId } : { created_by: customerUserId }),
            delivery_address: deliveryAddress,
            description,
            subtotal,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            items: items.map((item) => ({
                po_detail_id: item.po_detail_id || undefined,
                id_product: item.id_product,
                qty: Number(item.qty),
                selected_uom: item.selected_uom,
                unit_price: item.unit_price,
                total_price: item.total_price
            }))
        };

        try {
            setActionLoading(loadingType);
            const result = await savePO(poId, payload);
            if (result.success) {
                const msg = targetStatus === 'Draft'
                    ? 'PO saved as Draft successfully!'
                    : (poId && poStatus === 'Waiting for Confirmation' ? 'PO updated successfully!' : 'PO submitted successfully!');

                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: msg
                });

                if (onSuccess) onSuccess();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: 'Failed to save PO: ' + (result.message || 'An error occurred.')
                });
            }
        } catch (err) {
            console.error('Error submitting PO:', err);
            showAlert({
                type: 'error',
                title: 'Connection Error',
                message: 'A connection error occurred while saving the PO.'
            });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmit = (e, formData) => {
        if (e) e.preventDefault();

        // Mengambil target_status dari tombol yang diklik (Save as Draft / Submit PO)
        const targetStatus = e?.nativeEvent?.submitter?.getAttribute('value') || 'Waiting for Confirmation';

        const { items } = formData;

        const invalidItem = items.find((i) => !i.id_product || i.qty <= 0);
        if (invalidItem) {
            showAlert({
                type: 'warning',
                title: 'Validation Error',
                message: 'Please select a product and ensure Quantity is greater than 0 for all rows.'
            });
            return;
        }

        let confirmTitle = 'Save Changes';
        let confirmMsg = 'Are you sure you want to save changes to this PO?';

        if (targetStatus === 'Draft') {
            confirmTitle = 'Save as Draft';
            confirmMsg = 'Are you sure you want to save this PO as Draft?';
        } else if (targetStatus === 'Waiting for Confirmation') {
            confirmTitle = 'Submit PO';
            confirmMsg = poId
                ? 'Are you sure you want to submit this PO for confirmation?'
                : 'Are you sure you want to create and submit this new PO?';
        }

        let loadingType = 'SAVE';
        if (targetStatus === 'Draft') {
            loadingType = 'SAVE_DRAFT';
        } else if (targetStatus === 'Waiting for Confirmation') {
            loadingType = poId && formData.poStatus === 'Waiting for Confirmation' ? 'SAVE' : 'SUBMIT';
        }

        // Tampilkan Modal Konfirmasi Global
        showConfirm({
            title: confirmTitle,
            message: confirmMsg,
            onConfirm: () => executeSavePO(targetStatus, formData, loadingType)
        });
    };

    const handleCancelPO = () => {
        showConfirm({
            title: 'Cancel PO',
            message: 'Are you sure you want to cancel this PO?',
            isDanger: true,
            confirmText: 'Yes, Cancel PO',
            onConfirm: async () => {
                try {
                    setActionLoading('CANCEL');
                    const result = await cancelPOApi(poId, customerUserId);
                    if (result.success) {
                        showAlert({
                            type: 'success',
                            title: 'Success',
                            message: 'PO cancelled successfully!'
                        });
                        if (onSuccess) onSuccess();
                    } else {
                        showAlert({
                            type: 'error',
                            title: 'Failed',
                            message: 'Failed to cancel PO: ' + result.message
                        });
                    }
                } catch (err) {
                    console.error('Error canceling PO:', err);
                    showAlert({
                        type: 'error',
                        title: 'Error',
                        message: 'An error occurred while cancelling the PO.'
                    });
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleUpdateStatus = (newStatus) => {
        const targetAction = newStatus === 'Rejected' ? 'REJECT' : 'APPROVE';

        if (newStatus === 'Rejected') {
            // Tampilkan Modal Prompt Teks untuk alasan Reject
            showConfirm({
                title: 'Reject PO',
                message: 'Please enter the reason for rejecting this Purchase Order:',
                type: 'prompt',
                inputLabel: 'Rejection Reason',
                maxLength: 50,
                isDanger: true,
                confirmText: 'Reject PO',
                onConfirm: (notes) => executeStatusUpdate('Rejected', notes, targetAction)
            });
        } else if (newStatus === 'Approved') {
            showConfirm({
                title: 'Approve PO',
                message: 'Are you sure you want to APPROVE this PO?',
                confirmText: 'Approve',
                onConfirm: () => executeStatusUpdate('Approved', '', targetAction)
            });
        } else {
            showConfirm({
                title: 'Update PO Status',
                message: `Are you sure you want to change PO status to ${newStatus}?`,
                onConfirm: () => executeStatusUpdate(newStatus, '', targetAction)
            });
        }
    };

    const executeStatusUpdate = async (status, notes, targetAction) => {
        try {
            setActionLoading(targetAction);
            const result = await updatePOStatusApi(poId, status, notes, employeeId);

            if (result.success) {
                const successMsg = status === 'Rejected'
                    ? 'PO rejected successfully!'
                    : (status === 'Approved' ? 'PO approved successfully!' : `PO status successfully updated to ${status}!`);

                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: successMsg
                });

                if (onSuccess) onSuccess();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: result.message || 'Failed to update PO status.'
                });
            }
        } catch (err) {
            console.error('Error updating status:', err);
            showAlert({
                type: 'error',
                title: 'Connection Error',
                message: 'A server connection error occurred.'
            });
        } finally {
            setActionLoading(null);
        }
    };

    return {
        actionLoading,
        handleSubmit,
        handleCancelPO,
        handleUpdateStatus
    };
};
