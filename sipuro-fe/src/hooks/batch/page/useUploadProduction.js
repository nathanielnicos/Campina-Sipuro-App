import { useState, useRef } from 'react';
import {
    previewProductionApi,
    confirmProductionApi
} from '../../../services/productionUploadApi';

export const useUploadProduction = ({ currentUserId, onSuccessSave }) => {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const [previewData, setPreviewData] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reset state & clear HTML file input value
    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUploadSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        const actualFile = fileInputRef.current && fileInputRef.current.files[0];
        if (!actualFile) {
            alert('Please select an Excel file first!');
            return;
        }

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
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err) {
            setUploading(false);
            alert('An error occurred while uploading the file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmSave = async () => {
        if (!previewData) return;

        // Strictly extract newRows and unallocatedRows without OR fallbacks
        const rawNewRows = previewData.newRows || [];
        const unallocatedRows = previewData.unallocatedRows || [];

        // Set keys for unallocated items to strictly filter them out
        const unallocatedKeys = new Set(
            unallocatedRows.map(u => `${u.batchNumber}_${u.itemCode}`)
        );

        // Filter newDetails so it strictly carries allocated rows only
        const validNewDetails = rawNewRows.filter(
            r => !unallocatedKeys.has(`${r.batchNumber}_${r.itemCode}`)
        );

        const duplicateStatusRows = previewData.duplicateStatusUpdateRows || [];
        const validCount = previewData.previewResults ? previewData.previewResults.length : 0;

        if (validCount === 0) {
            alert('No valid data available to save.');
            return;
        }

        const confirmMsg = previewData.isReupload
            ? `${previewData.warningMessage}\nAre you sure you want to re-save this production allocation?`
            : `Save ${validCount} valid row(s) to PO allocation?`;

        if (!window.confirm(confirmMsg)) return;

        setSaving(true);

        try {
            // OPTIMISASI PAYLOAD (Trim data berulang untuk cegah Vercel 413 Payload Too Large)

            // 1. Trim allocations: Hapus teks berulang seperti productName, productCode, dll.
            const trimmedAllocations = (previewData.detailedAllocations || []).map(a => ({
                poDetailId: a.poDetailId,
                idProduct: a.idProduct,
                batchNumber: a.batchNumber,
                addedQty: a.addedQty || a.fulfilledQty,
                rowStatus: a.rowStatus
            }));

            // 2. Trim newDetails: Ambil hanya properti yang dibutuhkan database
            const trimmedNewDetails = validNewDetails.map(d => ({
                batchNumber: d.batchNumber,
                lotNumber: d.lotNumber,
                itemCode: d.itemCode,
                qtyPac: d.qtyPac,
                actualStartDatetime: d.actualStartDatetime,
                actualCompletedDatetime: d.actualCompletedDatetime,
                rowHash: d.rowHash
            }));

            const payload = {
                processTimestamp: previewData.processTimestamp,
                fileHash: previewData.fileHash,
                fileName: previewData.fileName,
                userId: currentUserId,
                allocations: trimmedAllocations,
                newDetails: trimmedNewDetails,
                duplicateStatusUpdateRows: duplicateStatusRows
            };

            const res = await confirmProductionApi(payload);
            setSaving(false);

            if (res && res.success) {
                alert(res.message || 'Successfully saved!');
                handleResetUploadState();
                if (onSuccessSave) onSuccessSave();
            } else {
                alert('Save failed: ' + (res?.message || 'An error occurred.'));
            }
        } catch (err) {
            setSaving(false);
            alert('An error occurred while saving the data.');
        }
    };

    const handleRejectPreview = () => {
        handleResetUploadState();
    };

    return {
        fileInputRef,
        uploading,
        previewData,
        isPreviewOpen,
        saving,
        handleUploadSubmit,
        handleConfirmSave,
        handleRejectPreview
    };
};
