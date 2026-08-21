export const getStatusStyle = (status) => {
    switch (status) {
        case 'Waiting for Confirmation':
            return { backgroundColor: '#fff3cd', color: '#856404' }; // Kuning
        case 'Waiting Batch Assignment':
            return { backgroundColor: '#d1ecf1', color: '#0c5460' }; // Cyan / Biru Muda
        case 'Rejected':
            return { backgroundColor: '#f8d7da', color: '#721c24' }; // Merah
        case 'Canceled':
            return { backgroundColor: '#e2e3e5', color: '#383d41' }; // Abu-abu
        case 'Completed':
            return { backgroundColor: '#d4edda', color: '#155724' }; // Hijau
        default:
            return { backgroundColor: '#e2e3e5', color: '#383d41' };
    }
};
