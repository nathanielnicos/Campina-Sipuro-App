import { useState, useRef } from 'react';
import { previewSalesInvoiceApi, confirmSalesInvoiceApi } from '../../services/siApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useUploadSi = ({ currentUserId, onSuccessSave }) => {
    const { showAlert, showConfirm } = useGlobalModal();

    const fileInputRef = useRef(null);
    const previewFileRef = useRef(null);
    const savingRef = useRef(false);

    const [uploading, setUploading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        previewFileRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUploadSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        const actualFile = fileInputRef.current && fileInputRef.current.files[0];
        if (!actualFile) {
            showAlert({ type: 'warning', title: 'No File Selected', message: 'Please select an Excel file first!' });
            return;
        }

        setUploading(true);

        try {
            // Memory Snapshot Buffer
            const fileBuffer = await actualFile.arrayBuffer();
            const memoryFile = new File([fileBuffer], actualFile.name, {
                type: actualFile.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const formData = new FormData();
            formData.append('file', memoryFile);

            const res = await previewSalesInvoiceApi(formData);
            setUploading(false);

            if (res && res.success) {
                previewFileRef.current = memoryFile;
                setPreviewData(res.data);
                setIsPreviewOpen(true);
            } else {
                showAlert({ type: 'error', title: 'Upload Failed', message: res?.message || 'Failed to process file.' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err) {
            setUploading(false);
            showAlert({ type: 'error', title: 'Upload Error', message: 'An error occurred while uploading the file.' });
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const executeConfirmSave = async () => {
        if (savingRef.current) return;

        const fileToCommit = previewFileRef.current;
        if (!previewData || !fileToCommit) {
            showAlert({ type: 'error', title: 'Save Failed', message: 'The preview file is no longer available. Please upload again.' });
            return;
        }

        savingRef.current = true;
        setSaving(true);

        try {
            const payload = new FormData();
            payload.append('file', fileToCommit);
            payload.append('userId', String(currentUserId));
            payload.append('fingerprint', previewData.fingerprint || '');

            const res = await confirmSalesInvoiceApi(payload);

            if (res && res.success) {
                showAlert({ type: 'success', title: 'Success', message: res.message || 'Successfully saved!' });
                handleResetUploadState();
                if (onSuccessSave) onSuccessSave();
            } else {
                showAlert({ type: 'error', title: 'Save Failed', message: res?.message || 'An error occurred.' });
            }
        } catch (err) {
            showAlert({ type: 'error', title: 'Save Error', message: 'An error occurred while saving the data.' });
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const handleConfirmSave = async () => {
        if (!previewData || savingRef.current) return;

        if (previewData.isReupload) {
            showAlert({ type: 'warning', title: 'Cannot Save', message: previewData.warningMessage || 'This file has already been uploaded previously.' });
            return;
        }

        if (!currentUserId) {
            showAlert({ type: 'error', title: 'Cannot Save', message: 'User information is missing. Please log in again.' });
            return;
        }

        if (!previewData.canSave) {
            showAlert({ type: 'warning', title: 'No Data', message: 'No valid data available to save.' });
            return;
        }

        const validCount = previewData.summary?.validCount || 0;
        showConfirm({
            title: 'Confirm Save Sales Invoice',
            message: `Save ${validCount} valid Sales Invoice row(s) to the database?`,
            confirmText: 'Save',
            onConfirm: () => executeConfirmSave()
        });
    };

    return {
        fileInputRef,
        uploading,
        previewData,
        isPreviewOpen,
        saving,
        handleUploadSubmit,
        handleConfirmSave,
        handleRejectPreview: handleResetUploadState
    };
};
