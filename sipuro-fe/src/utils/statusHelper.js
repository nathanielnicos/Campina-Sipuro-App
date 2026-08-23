export const getStatusStyle = (status) => {
    switch (status) {
        case 'Waiting for Confirmation':
            return { backgroundColor: '#fff3cd', color: '#856404' }; // Kuning[cite: 8]
        case 'Waiting Batch Assignment':
            return { backgroundColor: '#d1ecf1', color: '#0c5460' }; // Cyan / Biru Muda[cite: 8]
        case 'On Process':
            return { backgroundColor: '#cce5ff', color: '#004085' }; // Biru Soft (Bedakan dari Canceled)
        case 'Completed':
            return { backgroundColor: '#d4edda', color: '#155724' }; // Hijau[cite: 8]
        case 'Rejected':
            return { backgroundColor: '#f8d7da', color: '#721c24' }; // Merah[cite: 8]
        case 'Canceled':
            return { backgroundColor: '#e2e3e5', color: '#383d41' }; // Abu-abu gelap[cite: 8]
        case 'Open':
            return { backgroundColor: '#e2f0d9', color: '#385723' }; // Hijau Muda Soft
        case 'Close':
            return { backgroundColor: '#f2f2f2', color: '#595959' }; // Muted Grey
        default:
            return { backgroundColor: '#e2e3e5', color: '#383d41' };
    }
};
