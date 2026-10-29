import { useProductSearch } from '../../../hooks/master/useProductSearch';
import { isFlagOn } from '../../../utils/flagHelper';
import { getStatusStyle } from '../../../utils/statusHelper';

export const ProductLabel = ({ product }) => (
    <span>
        <strong>{product.product_code}</strong>
        <span style={{ color: '#6c757d' }}> · {product.product_name}</span>
        {!isFlagOn(product.is_active) && (
            <span style={{ ...getStatusStyle('Inactive'), marginLeft: '8px' }}>Inactive</span>
        )}
    </span>
);

const ProductPicker = ({ label, selected, onSelect, excludeId }) => {
    const { term, setTerm, results, loading, error } = useProductSearch();

    return (
        <div role="group" aria-label={label} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>{label}</div>

            {selected ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', border: '1px solid #74c0fc', borderRadius: '6px', backgroundColor: '#e7f5ff' }}>
                    <ProductLabel product={selected} />
                    <button type="button" onClick={() => onSelect(null)} style={{ border: 'none', background: 'none', color: '#1971c2', cursor: 'pointer', fontSize: '13px' }}>
                        Change
                    </button>
                </div>
            ) : (
                <div>
                    <input
                        type="text"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Search product code or name..."
                        aria-label={`${label} search`}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px' }}
                    />
                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e9ecef', borderRadius: '6px', marginTop: '6px' }}>
                        {loading && <div style={{ padding: '8px 10px', fontSize: '13px', color: '#6c757d' }}>Searching...</div>}
                        {!loading && error && <div style={{ padding: '8px 10px', fontSize: '13px', color: '#e03131' }}>{error}</div>}
                        {!loading && !error && results.length === 0 && (
                            <div style={{ padding: '8px 10px', fontSize: '13px', color: '#6c757d' }}>No products found.</div>
                        )}
                        {!loading && !error && results.map((product) => {
                            const disabled = product.id_product === excludeId;
                            return (
                                <button
                                    key={product.id_product}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onSelect(product)}
                                    title={disabled ? 'Already chosen on the other side' : ''}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid #f1f3f5', background: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, fontSize: '13px' }}
                                >
                                    <ProductLabel product={product} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductPicker;
