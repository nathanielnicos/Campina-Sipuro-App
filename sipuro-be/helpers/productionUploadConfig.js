/**
 * Konfigurasi upload produksi. Ubah nilai di sini bila perlu.
 */
module.exports = {
    // Batas jumlah baris data per upload (setelah header dan SubTot dibuang)
    MAX_UPLOAD_ROWS: 1000,
    // Batas ukuran file (Vercel membatasi body sekitar 4,5 MB)
    MAX_UPLOAD_FILE_BYTES: 4 * 1024 * 1024,
    // Nama advisory lock MySQL agar commit upload berjalan satu per satu
    COMMIT_LOCK_NAME: 'sipuro_production_commit',
    COMMIT_LOCK_TIMEOUT_SECONDS: 10
};
