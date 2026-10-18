import { useState, useEffect } from 'react';

/**
 * Menunda perubahan nilai sampai pengguna berhenti mengubahnya selama `delay` ms.
 * Dipakai agar kolom pencarian tidak memanggil server pada setiap ketukan tombol.
 */
const useDebounce = (value, delay = 400) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
};

export default useDebounce;
