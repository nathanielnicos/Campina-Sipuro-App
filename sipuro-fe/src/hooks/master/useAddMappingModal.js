import { useState } from 'react';
import { createProductCodeMapping } from '../../services/productCodeMappingApi';

export const useAddMappingModal = ({ onCreated }) => {
    const [oldProduct, setOldProduct] = useState(null);
    const [newProduct, setNewProduct] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const sameProduct = Boolean(oldProduct && newProduct && oldProduct.id_product === newProduct.id_product);
    const canSubmit = Boolean(oldProduct && newProduct) && !sameProduct && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError('');
        try {
            const res = await createProductCodeMapping(oldProduct.id_product, newProduct.id_product);
            onCreated(res);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create the mapping.');
        } finally {
            setSubmitting(false);
        }
    };

    return {
        oldProduct,
        setOldProduct: (p) => { setOldProduct(p); setError(''); },
        newProduct,
        setNewProduct: (p) => { setNewProduct(p); setError(''); },
        sameProduct,
        canSubmit,
        submitting,
        error,
        handleSubmit
    };
};
