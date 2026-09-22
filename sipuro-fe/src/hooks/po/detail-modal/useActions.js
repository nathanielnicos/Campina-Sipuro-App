import { useState } from 'react';
import { savePO, cancelPOApi, updatePOStatusApi } from '../../../services/poApi';

export const useActions = ({ poId, currentUser, onSuccess }) => {
    // Simpan jenis aksi yang sedang loading, contoh: 'SAVE', 'CANCEL', 'APPROVE', 'REJECT', atau null
    const [actionLoading, setActionLoading] = useState(null);

    const userRole = currentUser?.role;
    const customerUserId = userRole === 'CUSTOMER' ? currentUser?.id : null;
    const employeeId = userRole !== 'CUSTOMER' ? currentUser?.id : null;

    const handleSubmit = async (e, formData) => {
        if (e) e.preventDefault();

        const { requestedDeliveryDate, deliveryAddress, description, subtotal, taxAmount, grandTotal, items, customerId } = formData;

        const invalidItem = items.find((i) => !i.id_product || i.qty <= 0);
        if (invalidItem) {
            alert('Please select a product and ensure Quantity is greater than 0 for all rows.');
            return;
        }

        const confirmMsg = poId ? 'Are you sure you want to save changes to this PO?' : 'Are you sure you want to create this new PO?';
        if (!window.confirm(confirmMsg)) return;

        const payload = {
            customer_id: customerId,
            ...(poId ? { updated_by: customerUserId } : { created_by: customerUserId }),
            requested_delivery_date: requestedDeliveryDate,
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
            setActionLoading('SAVE');
            const result = await savePO(poId, payload);
            if (result.success) {
                alert(poId ? 'PO updated successfully!' : 'PO created successfully!');
                if (onSuccess) onSuccess();
            } else {
                alert('Failed to save PO: ' + (result.message || 'An error occurred.'));
            }
        } catch (err) {
            console.error('Error submitting PO:', err);
            alert('A connection error occurred while saving the PO.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelPO = async () => {
        if (!window.confirm('Are you sure you want to cancel this PO?')) return;

        try {
            setActionLoading('CANCEL');
            const result = await cancelPOApi(poId, customerUserId);
            if (result.success) {
                alert('PO cancelled successfully!');
                if (onSuccess) onSuccess();
            } else {
                alert('Failed to cancel PO: ' + result.message);
            }
        } catch (err) {
            console.error('Error canceling PO:', err);
            alert('An error occurred while cancelling the PO.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        let notes = '';
        const targetAction = newStatus === 'Rejected' ? 'REJECT' : 'APPROVE';

        if (newStatus === 'Rejected') {
            const inputNotes = prompt('Enter rejection reason (Maximum 50 characters):');
            if (inputNotes === null) return;

            const trimmedNotes = inputNotes.trim();
            if (!trimmedNotes) {
                alert('Rejection reason is required!');
                return;
            }
            if (trimmedNotes.length > 50) {
                alert(`Rejection reason is too long (${trimmedNotes.length} characters). Maximum 50 characters!`);
                return;
            }
            notes = trimmedNotes;

            if (!window.confirm('Are you sure you want to REJECT this PO?')) return;
        } else if (newStatus === 'Approved') {
            if (!window.confirm('Are you sure you want to APPROVE this PO?')) return;
        } else {
            if (!window.confirm(`Are you sure you want to change PO status to ${newStatus}?`)) return;
        }

        try {
            setActionLoading(targetAction);
            const result = await updatePOStatusApi(poId, newStatus, notes, employeeId);

            if (result.success) {
                if (newStatus === 'Rejected') alert('PO rejected successfully!');
                else if (newStatus === 'Approved') alert('PO approved successfully!');
                else alert(`PO status successfully updated to ${newStatus}!`);

                if (onSuccess) onSuccess();
            } else {
                alert(result.message || 'Failed to update PO status.');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('A server connection error occurred.');
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
