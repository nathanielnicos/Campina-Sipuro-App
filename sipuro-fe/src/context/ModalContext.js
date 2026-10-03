import { createContext, useContext, useState } from 'react';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
    // State untuk Modal Konfirmasi / Prompt Rejection
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm', // 'confirm' | 'prompt'
        inputLabel: '',
        maxLength: 50,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        isDanger: false,
        onConfirm: null,
        onCancel: null
    });

    // State untuk Modal Alert (Sukses / Eror / Info)
    const [alertState, setAlertState] = useState({
        isOpen: false,
        type: 'success', // 'success' | 'error' | 'warning' | 'info'
        title: '',
        message: '',
        onClose: null
    });

    // State temporer untuk input teks (misal: alasan penolakan / rejection reason)
    const [promptValue, setPromptValue] = useState('');
    const [promptError, setPromptError] = useState('');

    // --- FUNGSI PEMANGGIL GLOBAL ---

    // 1. Fungsi Konfirmasi & Prompt Input Teks
    const showConfirm = ({
        title = 'Confirmation',
        message = 'Are you sure?',
        type = 'confirm',
        inputLabel = '',
        maxLength = 50,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        isDanger = false,
        onConfirm,
        onCancel
    }) => {
        setPromptValue('');
        setPromptError('');
        setConfirmState({
            isOpen: true,
            title,
            message,
            type,
            inputLabel,
            maxLength,
            confirmText,
            cancelText,
            isDanger,
            onConfirm,
            onCancel
        });
    };

    // 2. Fungsi Alert / Notifikasi
    const showAlert = ({
        type = 'info',
        title = 'Notification',
        message = '',
        onClose
    }) => {
        setAlertState({
            isOpen: true,
            type,
            title,
            message,
            onClose
        });
    };

    // --- HANDLER EVENT ---
    const handleCloseConfirm = () => {
        if (confirmState.onCancel) confirmState.onCancel();
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
    };

    const handleExecuteConfirm = () => {
        if (confirmState.type === 'prompt') {
            const trimmed = promptValue.trim();
            if (!trimmed) {
                setPromptError('This field is required!');
                return;
            }
            if (trimmed.length > confirmState.maxLength) {
                setPromptError(`Maximum ${confirmState.maxLength} characters allowed!`);
                return;
            }
            if (confirmState.onConfirm) confirmState.onConfirm(trimmed);
        } else {
            if (confirmState.onConfirm) confirmState.onConfirm();
        }
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
    };

    const handleCloseAlert = () => {
        if (alertState.onClose) alertState.onClose();
        setAlertState((prev) => ({ ...prev, isOpen: false }));
    };

    return (
        <ModalContext.Provider value={{ showConfirm, showAlert }}>
            {children}

            {/* ================= MODAL KONFIRMASI / PROMPT (z-index 9999) ================= */}
            {confirmState.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: '#fff', borderRadius: '8px', padding: '24px',
                        width: '420px', maxWidth: '90vw', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                    }}>
                        <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: '#212529' }}>
                            {confirmState.title}
                        </h4>
                        <p style={{ fontSize: '14px', color: '#495057', marginBottom: '16px', lineHeight: '1.4' }}>
                            {confirmState.message}
                        </p>

                        {/* Input teks jika tipe modal adalah PROMPT */}
                        {confirmState.type === 'prompt' && (
                            <div style={{ marginBottom: '16px' }}>
                                {confirmState.inputLabel && (
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>
                                        {confirmState.inputLabel}
                                    </label>
                                )}
                                <textarea
                                    value={promptValue}
                                    onChange={(e) => {
                                        setPromptValue(e.target.value);
                                        setPromptError('');
                                    }}
                                    maxLength={confirmState.maxLength}
                                    rows={3}
                                    placeholder="Enter details here..."
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '4px',
                                        border: promptError ? '1px solid #dc3545' : '1px solid #ced4da',
                                        fontSize: '13px', boxSizing: 'border-box', outline: 'none',
                                        resize: 'vertical'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    {promptError ? (
                                        <div style={{ color: '#dc3545', fontSize: '12px' }}>
                                            {promptError}
                                        </div>
                                    ) : <div />}
                                    <span style={{ color: '#6c757d', fontSize: '11px' }}>
                                        {promptValue.length}/{confirmState.maxLength}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handleCloseConfirm}
                                style={{
                                    padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff',
                                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
                                }}
                            >
                                {confirmState.cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteConfirm}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: confirmState.isDanger ? '#dc3545' : '#0d6efd',
                                    color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 'bold'
                                }}
                            >
                                {confirmState.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL ALERT / NOTIFIKASI (z-index 10000) ================= */}
            {alertState.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10000
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '360px', maxWidth: '90vw',
                        textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            fontSize: '40px',
                            color: alertState.type === 'success' ? '#198754' : alertState.type === 'error' ? '#dc3545' : alertState.type === 'warning' ? '#ffc107' : '#0d6efd',
                            marginBottom: '12px'
                        }}>
                            {alertState.type === 'success' ? '✓' : alertState.type === 'error' ? '✕' : alertState.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </div>
                        <h4 style={{ marginTop: 0, marginBottom: '8px', fontSize: '18px', fontWeight: 'bold', color: '#212529' }}>
                            {alertState.title}
                        </h4>
                        <p style={{ fontSize: '14px', color: '#495057', marginBottom: '20px', lineHeight: '1.4' }}>
                            {alertState.message}
                        </p>
                        <button
                            type="button"
                            onClick={handleCloseAlert}
                            style={{
                                padding: '8px 24px',
                                backgroundColor: alertState.type === 'success' ? '#198754' : alertState.type === 'error' ? '#dc3545' : '#0d6efd',
                                color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
};

// Custom Hook untuk memanggil modal dari komponen/hook mana pun
export const useGlobalModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useGlobalModal must be used within a ModalProvider');
    }
    return context;
};
