const mysql = require('mysql2/promise');

const isLocalhost = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';

// Zona waktu aplikasi. Format wajib "+07:00" / "-05:00". Nilai tidak valid -> kembali ke WIB.
const TZ_PATTERN = /^[+-](0\d|1[0-4]):[0-5]\d$/;
const dbTimezone = TZ_PATTERN.test(process.env.DB_TIMEZONE || '') ? process.env.DB_TIMEZONE : '+07:00';
if (process.env.DB_TIMEZONE && dbTimezone !== process.env.DB_TIMEZONE) {
  console.warn(`DB_TIMEZONE "${process.env.DB_TIMEZONE}" tidak valid, memakai +07:00.`);
}

// Ukuran pool: env DB_POOL_SIZE, jika kosong -> 3 di Vercel (serverless), 10 di tempat lain.
const poolSize = parseInt(process.env.DB_POOL_SIZE, 10) || (process.env.VERCEL ? 3 : 10);

// SSL: verifikasi sertifikat hanya aktif jika DB_SSL_CA (isi sertifikat CA, boleh memakai \n literal) diisi.
// Jika kosong, perilaku sama seperti sebelumnya (koneksi terenkripsi tanpa verifikasi).
let ssl = false;
if (!isLocalhost) {
  const ca = process.env.DB_SSL_CA;
  ssl = ca
    ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
}

const sipuroDb = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sipuro_db',
  port: process.env.DB_PORT || 3306,
  ssl,
  waitForConnections: true,
  connectionLimit: poolSize,
  queueLimit: 0,
  timezone: dbTimezone
});

// Samakan zona waktu SESI di setiap koneksi baru, agar NOW(), CURDATE(),
// CURRENT_TIMESTAMP, dan kolom TIMESTAMP bekerja dalam WIB di Aiven maupun lokal.
sipuroDb.pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [dbTimezone], (err) => {
    if (err) {
      console.error('Gagal mengatur time_zone sesi database:', err.message);
    }
  });
});

module.exports = {
  sipuroDb,
  query: (...args) => sipuroDb.query(...args),
  execute: (...args) => sipuroDb.execute(...args),
  getConnection: () => sipuroDb.getConnection()
};
