import { useState } from 'react';
import { fetchBatchesBySku, assignBatchBulk } from '../../../services/batchApi';

export const useBatchAllocation = ({ currentUserId, onSuccessAllocation }) => {
    const [selectedSku, setSelectedSku] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allocationMode, setAllocationMode] = useState('');
    const [existingBatches, setExistingBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [allocatedQty, setAllocatedQty] = useState('');
    const [batchCode, setBatchCode] = useState('');
    const [productionDate, setProductionDate] = useState('');
    const [expiredDate, setExpiredDate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleOpenModal = async (sku) => {
        setSelectedSku(sku);
        setAllocatedQty(sku.total_qty_needed);
        setAllocationMode('');
        setSelectedBatchId('');
        setBatchCode('');
        setProductionDate(new Date().toISOString().split('T')[0]);
        setExpiredDate('');

        const res = await fetchBatchesBySku(sku.id_product);
        if (res && res.success) {
            setExistingBatches(res.data || []);
        } else {
            setExistingBatches([]);
        }

        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSku(null);
    };

    const handleSelectBatchExisting = (e) => {
        const batchId = e.target.value;
        setSelectedBatchId(batchId);
        const found = existingBatches.find((b) => String(b.id_batch) === String(batchId));
        if (found) {
            setBatchCode(found.batch_number);
            setProductionDate(found.plan_production_date ? found.plan_production_date.split('T')[0] : '');
            setExpiredDate(found.expired_date ? found.expired_date.split('T')[0] : '');
        } else {
            setBatchCode('');
            setProductionDate('');
            setExpiredDate('');
        }
    };

    const handleSubmitBatch = async (e) => {
        e.preventDefault();

        if (!allocationMode) return alert('Please select an allocation option.');

        const inputQty = Number(allocatedQty);
        if (!inputQty || inputQty <= 0) return alert('Allocation quantity must be greater than 0.');
        if (inputQty > selectedSku.total_qty_needed) {
            return alert(`Entered quantity (${inputQty}) exceeds total remaining demand (${selectedSku.total_qty_needed}).`);
        }

        if (allocationMode === 'NEW' && (!batchCode || !productionDate)) {
            return alert('Batch number and production date are required.');
        }
        if (allocationMode === 'EXISTING' && !selectedBatchId) {
            return alert('Please select an existing batch.');
        }

        const payload = {
            id_product: selectedSku.id_product,
            allocation_mode: allocationMode,
            selected_batch_id: selectedBatchId || null,
            batch_number: batchCode,
            plan_production_date: productionDate,
            expired_date: expiredDate || null,
            allocated_qty: inputQty,
            created_by: currentUserId
        };

        setSubmitting(true);
        const res = await assignBatchBulk(payload);
        setSubmitting(false);

        if (res && res.success) {
            alert(res.message);
            handleCloseModal();
            if (onSuccessAllocation) onSuccessAllocation();
        } else {
            alert('Allocation Failed: ' + (res?.message || 'An error occurred while allocating the batch.'));
        }
    };

    return {
        selectedSku,
        isModalOpen,
        allocationMode,
        existingBatches,
        selectedBatchId,
        allocatedQty,
        batchCode,
        productionDate,
        expiredDate,
        submitting,
        setAllocatedQty,
        setAllocationMode,
        setBatchCode,
        setProductionDate,
        setExpiredDate,
        handleOpenModal,
        handleCloseModal,
        handleSelectBatchExisting,
        handleSubmitBatch
    };
};
