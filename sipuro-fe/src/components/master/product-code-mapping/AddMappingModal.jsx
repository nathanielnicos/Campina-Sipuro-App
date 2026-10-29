import { useAddMappingModal } from '../../../hooks/master/useAddMappingModal';
import ProductPicker from './ProductPicker';

const AddMappingModal = ({ onClose, onCreated }) => {
    const form = useAddMappingModal({ onCreated });

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div role="dialog" aria-label="Add Product Code Mapping" style={{ backgroundColor: '#fff', borderRadius: '8px', width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }}>
                <h3 style={{ margin: '0 0 6px' }}>Add Product Code Mapping</h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6c757d' }}>
                    Link an old product code to its replacement. Production lots of either code can then fill POs of the other when no PO of their own code can take them.
                </p>

                <ProductPicker
                    label="Old Product Code"
                    selected={form.oldProduct}
                    onSelect={form.setOldProduct}
                    excludeId={form.newProduct?.id_product}
                />
                <ProductPicker
                    label="New Product Code"
                    selected={form.newProduct}
                    onSelect={form.setNewProduct}
                    excludeId={form.oldProduct?.id_product}
                />

                {form.error && (
                    <div role="alert" style={{ padding: '8px 10px', marginBottom: '12px', borderRadius: '6px', backgroundColor: '#ffe3e3', color: '#c92a2a', fontSize: '13px' }}>
                        {form.error}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" onClick={onClose} disabled={form.submitting} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ced4da', backgroundColor: '#fff', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={form.handleSubmit}
                        disabled={!form.canSubmit}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', color: '#fff', backgroundColor: form.canSubmit ? '#1971c2' : '#adb5bd', cursor: form.canSubmit ? 'pointer' : 'not-allowed' }}
                    >
                        {form.submitting ? 'Saving...' : 'Create Mapping'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddMappingModal;
