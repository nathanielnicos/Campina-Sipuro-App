// Penanda alokasi lintas kode produk (kode lama/baru dari produk yang sama lewat Product Code Mapping).
const CrossCodeTag = ({ show, caption, productCode }) => {
    if (!show) return null;

    return (
        <div style={{ marginTop: '4px' }}>
            <span
                title="Allocated through Product Code Mapping: the PO and the produced lot use different product codes."
                style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    backgroundColor: '#fff3cd',
                    color: '#664d03',
                    border: '1px solid #ffecb5'
                }}
            >
                via mapping &middot; {caption}: {productCode || '-'}
            </span>
        </div>
    );
};

export default CrossCodeTag;
