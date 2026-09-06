const POFormHeader = ({
    userRole,
    poStatus,
    rejectionReason,
    requestedDeliveryDate,
    setRequestedDeliveryDate,
    deliveryAddress,
    setDeliveryAddress,
    description,
    setDescription
}) => {
    const isPPIC = userRole === 'PPIC';

    return (
        <>
            {poStatus === 'Rejected' && (
                <div style={{
                    backgroundColor: '#f8d7da',
                    color: '#842029',
                    border: '1px solid #f5c2c7',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '16px'
                }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Alasan Penolakan:</strong>
                    <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-line' }}>
                        {rejectionReason || 'Tidak ada alasan penolakan yang dicantumkan.'}
                    </p>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        Tanggal Pengiriman Diminta *
                    </label>
                    <input
                        type="date"
                        value={requestedDeliveryDate}
                        onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                        required
                        disabled={isPPIC}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                        Alamat Pengiriman
                    </label>
                    <input
                        type="text"
                        placeholder="Alamat pengiriman..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        disabled={isPPIC}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ced4da' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Catatan</label>
                <textarea
                    rows="2"
                    placeholder="Catatan tambahan untuk pesanan..."
                    value={description}
                    maxLength={50}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPPIC}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ced4da' }}
                />
                <small style={{ color: '#6c757d', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                    {description.length}/50 karakter
                </small>
            </div>
        </>
    );
};

export default POFormHeader;
