import { useState, useEffect, useRef } from 'react';
import { getProducts } from '../../services/superadminApi';

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 10;

// Pencarian produk (kode/nama) dengan jeda ketik; produk nonaktif ikut tampil.
export const useProductSearch = () => {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestIdRef = useRef(0);

    useEffect(() => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await getProducts(1, RESULT_LIMIT, term.trim());
                if (requestId !== requestIdRef.current) return;
                setResults(res.success ? res.data : []);
                setError('');
            } catch (err) {
                if (requestId !== requestIdRef.current) return;
                setResults([]);
                setError(err.response?.data?.message || 'Failed to search products.');
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [term]);

    return { term, setTerm, results, loading, error };
};
