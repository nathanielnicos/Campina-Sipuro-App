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

    // Reset state & hapus value pada HTML file input
    const handleResetUploadState = () => {
        setIsPreviewOpen(false);
        setPreviewData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Memungkinkan unggah file yang sama kembali
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
                // Bersihkan input jika upload gagal agar user bisa pilih file ulang
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err) {
            setUploading(false);
            alert('An error occurred while uploading the file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmSave = async (modalPayload = {}) => {
        if (!previewData) return;

        const validNewDetails = modalPayload.newDetails
            || previewData.validData
            || previewData.categorizedDetails?.newRows
            || [];

        const unallocatedStocks = previewData.unallocatedStocks || [];
        const duplicateStatusRows = previewData.duplicateStatusUpdateRows
            || previewData.categorizedDetails?.duplicateStatusUpdateRows
            || [];

        const validCount = validNewDetails.length || previewData.summary?.newCount || 0;
        const unallocatedCount = unallocatedStocks.length || previewData.summary?.unallocatedCount || 0;

        // Izinkan simpan jika ada valid data ATAU unallocated data
        if (validCount === 0 && unallocatedCount === 0) {
            alert('Tidak ada data valid atau unallocated yang dapat disimpan.');
            return;
        }

        const confirmMsg = previewData.isReupload
            ? `${previewData.warningMessage}\nApakah Anda yakin ingin menyimpan ulang alokasi produksi ini?`
            : `Simpan ${validCount} baris valid dan ${unallocatedCount} item unallocated?`;

        if (!window.confirm(confirmMsg)) return;

        setSaving(true);

        try {
            const payload = {
                processTimestamp: previewData.processTimestamp,
                fileHash: previewData.fileHash,
                fileName: previewData.fileName,
                userId: currentUserId,
                allocations: previewData.detailedAllocations || [],
                unallocatedStocks: unallocatedStocks,
                newDetails: validNewDetails,
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
