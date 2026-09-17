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

    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();

        const actualFile = fileInputRef.current && fileInputRef.current.files[0];
        if (!actualFile) return alert('Please select an Excel file first!');

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
            }
        } catch (err) {
            setUploading(false);
            alert('An error occurred while uploading the file.');
        }
    };

    const handleConfirmSave = async (modalPayload = {}) => {
        if (!previewData) return;

        // Fallback aman untuk menghitung baris newDetails
        const validNewDetails = modalPayload.newDetails
            || previewData.categorizedDetails?.newRows
            || [];

        const newDetailsCount = validNewDetails.length || previewData.summary?.newCount || 0;

        const confirmMsg = previewData.isReupload
            ? `${previewData.warningMessage}\nAre you sure you want to resave this production allocation?`
            : `Save ${newDetailsCount} new valid row(s) to the database?`;

        if (!window.confirm(confirmMsg)) return;

        setSaving(true);

        const payload = {
            processTimestamp: previewData.processTimestamp,
            fileHash: previewData.fileHash,
            fileName: previewData.fileName,
            userId: currentUserId,
            allocations: previewData.detailedAllocations || [],
            unallocatedStocks: previewData.unallocatedStocks || [],
            newDetails: validNewDetails
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
