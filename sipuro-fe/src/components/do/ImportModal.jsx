// import React, { useState } from 'react';

// const ImportModal = ({ isOpen, onClose, onSuccess }) => {
//     const [file, setFile] = useState(null);
//     const [loading, setLoading] = useState(false);
//     const [previewResult, setPreviewResult] = useState(null);
//     const [error, setError] = useState(null);

//     if (!isOpen) return null;

//     const handleFileChange = (e) => {
//         setFile(e.target.files[0]);
//         setError(null);
//     };

//     const handlePreview = async () => {
//         if (!file) return setError('Silakan pilih file Excel terlebih dahulu.');
//         setLoading(true);
//         setError(null);

//         try {
//             const formData = new FormData();
//             formData.append('file', file);
//             const res = await previewImportApi(formData);
//             if (res.success) {
//                 setPreviewResult(res);
//             } else {
//                 setError(res.message);
//             }
//         } catch (err) {
//             setError(err.message || 'Gagal memproses preview file.');
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleCommit = async () => {
//         if (!previewResult) return;
//         setLoading(true);
//         setError(null);

//         try {
//             const payload = {
//                 fileName: previewResult.fileName,
//                 fileHash: previewResult.fileHash,
//                 items: previewResult.previewData
//             };
//             const res = await commitImportApi(payload);
//             if (res.success) {
//                 onSuccess();
//                 onClose();
//             } else {
//                 setError(res.message);
//             }
//         } catch (err) {
//             setError(err.message || 'Gagal menyimpan data.');
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <div style={{
//             position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
//             backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
//             display: 'flex', justifyContent: 'center', alignItems: 'center'
//         }}>
//             <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
//                 <h3>Import Excel Document Flow</h3>

//                 {!previewResult ? (
//                     <div>
//                         <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
//                         {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
//                         <div style={{ marginTop: '20px', textAlign: 'right' }}>
//                             <button onClick={onClose} style={{ marginRight: '10px' }}>Batal</button>
//                             <button onClick={handlePreview} disabled={loading}>
//                                 {loading ? 'Memproses...' : 'Preview Data'}
//                             </button>
//                         </div>
//                     </div>
//                 ) : (
//                     <div>
//                         <h4>Ringkasan Import</h4>
//                         <p>File: <strong>{previewResult.fileName}</strong></p>
//                         <p>Total Baris Valid: <strong>{previewResult.summary.totalRowsParsed}</strong></p>

//                         {previewResult.unregisteredSKUs.length > 0 && (
//                             <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
//                                 <strong>Warning Unregistered SKU:</strong>
//                                 <ul>
//                                     {previewResult.unregisteredSKUs.map((sku, idx) => (
//                                         <li key={idx}>{sku}</li>
//                                     ))}
//                                 </ul>
//                             </div>
//                         )}

//                         {error && <p style={{ color: 'red' }}>{error}</p>}

//                         <div style={{ marginTop: '20px', textAlign: 'right' }}>
//                             <button onClick={() => setPreviewResult(null)} style={{ marginRight: '10px' }}>Kembali</button>
//                             <button onClick={handleCommit} disabled={loading} style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px' }}>
//                                 {loading ? 'Menyimpan...' : 'Save / Commit Data'}
//                             </button>
//                         </div>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default ImportModal;
