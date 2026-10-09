import { useState, useRef } from 'react';
import {
    previewDocumentFlow,
    commitDocumentFlow
} from '../../../services/documentFlowApi';
import { useGlobalModal } from '../../../context/ModalContext';

export const useUploadDocumentFlow = ({ currentUserId, onSuccessSave }) => {
    // Context Modal Global
    const { showAlert, showConfirm } = useGlobalModal();

    const fileInputRef = useRef(null);
    // File yang dipakai saat preview. Dikirim ulang saat commit agar server menghitung ulang dari file yang sama,
    // walaupun user mengubah isi input file setelah preview.
    const previewFileRef = useRef(null);
    // Guard sinkron terhadap klik ganda (state `saving` bisa terlambat diperbarui)
    const savingRef = useRef(false);

    const [uploading, setUploading] = useState(false);

    const [previewData, setPreviewData] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reset state & clear HTML file input value
    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        previewFileRef.current = null;
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
            const res = await previewDocumentFlow(formData);
            setUploading(false);

            if (res && res.success) {
                previewFileRef.current = actualFile;
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

    // Fungsi internal untuk eksekusi penyimpanan setelah konfirmasi disetujui.
    // Server menghitung ulang alokasi dari file yang dikirim; client tidak mengirim hasil alokasi.
    const executeConfirmSave = async () => {
        if (savingRef.current) return;

        const fileToCommit = previewFileRef.current;
        if (!previewData || !fileToCommit) {
            showAlert({
                type: 'error',
                title: 'Save Failed',
                message: 'The preview file is no longer available. Please upload the file again.'
            });
            return;
        }

        savingRef.current = true;
        setSaving(true);

        try {
            const payload = new FormData();
            payload.append('file', fileToCommit);
            payload.append('userId', String(currentUserId));
            payload.append('fingerprint', previewData.fingerprint || '');

            const res = await commitDocumentFlow(payload);

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
            showAlert({
                type: 'error',
                title: 'Save Error',
                message: 'An error occurred while saving the data.'
            });
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const handleConfirmSave = async () => {
        if (!previewData || savingRef.current) return;

        // Guard Tambahan: Jika file reupload, hentikan proses simpan
        if (previewData.isReupload) {
            showAlert({
                type: 'warning',
                title: 'Cannot Save',
                message: previewData.warningMessage || 'This file has already been uploaded previously.'
            });
            return;
        }

        if (!currentUserId) {
            showAlert({
                type: 'error',
                title: 'Cannot Save',
                message: 'User information is missing. Please log in again.'
            });
            return;
        }

        // Server menentukan apakah ada alokasi yang bisa disimpan
        if (!previewData.canSave) {
            showAlert({
                type: 'warning',
                title: 'No Data',
                message: 'No valid data available to save.'
            });
            return;
        }

        showConfirm({
            title: 'Confirm Save Allocation',
            message: `Save ... (?)`,
            confirmText: 'Save',
            onConfirm: () => executeConfirmSave()
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
}
