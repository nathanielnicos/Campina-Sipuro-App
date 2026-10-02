import { useState, useRef } from 'react';
import {
    previewProductionApi,
    confirmProductionApi
} from '../../../services/productionUploadApi';
import { useGlobalModal } from '../../../context/ModalContext';

export const useUploadProduction = ({ currentUserId, onSuccessSave }) => {
    // Context Modal Global
    const { showAlert, showConfirm } = useGlobalModal();

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
            showAlert({
                type: 'warning',
                title: 'No File Selected',
                message: 'Please select an Excel file first!'
            });
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
                showAlert({
                    type: 'error',
                    title: 'Upload Failed',
                    message: res?.message || 'Failed to process file.'
                });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err) {
            setUploading(false);
            showAlert({
                type: 'error',
                title: 'Upload Error',
                message: 'An error occurred while uploading the file.'
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Fungsi internal untuk eksekusi penyimpan setelah konfirmasi disetujui
    const executeConfirmSave = async (validNewDetails, duplicateStatusRows) => {
        setSaving(true);

        try {
            const payload = {
                processTimestamp: previewData.processTimestamp,
                fileHash: previewData.fileHash,
                fileName: previewData.fileName,
                userId: currentUserId,
                allocations: previewData.detailedAllocations,
                newDetails: validNewDetails,
                duplicateStatusUpdateRows: duplicateStatusRows
            };

            const res = await confirmProductionApi(payload);
            setSaving(false);

            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Successfully saved!'
                });
                handleResetUploadState();
                if (onSuccessSave) onSuccessSave();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Save Failed',
                    message: res?.message || 'An error occurred.'
                });
            }
        } catch (err) {
            setSaving(false);
            showAlert({
                type: 'error',
                title: 'Save Error',
                message: 'An error occurred while saving the data.'
            });
        }
    };

    const handleConfirmSave = async () => {
        if (!previewData) return;

        // Guard Tambahan: Jika file reupload, hentikan proses simpan
        if (previewData.isReupload) {
            showAlert({
                type: 'warning',
                title: 'Cannot Save',
                message: previewData.warningMessage || 'This file has already been uploaded previously.'
            });
            return;
        }

        // Strictly extract newRows and unallocatedRows without OR fallbacks
        const rawNewRows = previewData.newRows;
        const unallocatedRows = previewData.unallocatedRows;

        // Set keys for unallocated items to strictly filter them out
        const unallocatedKeys = new Set(
            unallocatedRows.map(u => `${u.batchNumber}_${u.itemCode}`)
        );

        // Filter newDetails so it strictly carries allocated rows only
        const validNewDetails = rawNewRows.filter(
            r => !unallocatedKeys.has(`${r.batchNumber}_${r.itemCode}`)
        );

        const duplicateStatusRows = previewData.duplicateStatusUpdateRows;
        const validCount = previewData.previewResults.length;

        if (validCount === 0) {
            showAlert({
                type: 'warning',
                title: 'No Data',
                message: 'No valid data available to save.'
            });
            return;
        }

        showConfirm({
            title: 'Confirm Save Allocation',
            message: `Save ${validCount} valid row(s) to PO allocation?`,
            confirmText: 'Save',
            onConfirm: () => executeConfirmSave(validNewDetails, duplicateStatusRows)
        });
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
