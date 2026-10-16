/**
 * Helper pesan error yang aman untuk respons API.
 *
 * Detail error (error.message) hanya dikirim ke klien saat NODE_ENV=development.
 * Di environment lain (production, test, atau NODE_ENV kosong) nilainya undefined,
 * sehingga properti tersebut otomatis tidak ikut di JSON respons.
 *
 * Contoh pemakaian di controller:
 *   res.status(500).json({ success: false, message: 'Server error.', error: safeError(error) });
 */
const safeError = (error) => {
    if (process.env.NODE_ENV === 'development' && error && error.message) {
        return error.message;
    }
    return undefined;
};

module.exports = { safeError };
