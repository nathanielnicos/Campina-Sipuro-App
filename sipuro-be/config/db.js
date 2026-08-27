const mysql = require('mysql2/promise');

// Pool koneksi ke Database Utama (sipuro_db)
const sipuroDb = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Sesuaikan dengan password MySQL Anda
  database: 'sipuro_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  sipuroDb,
  // Alias agar modul yang menggunakan const db = require('./db') tetap berjalan aman
  query: (...args) => sipuroDb.query(...args),
  execute: (...args) => sipuroDb.execute(...args),
  getConnection: () => sipuroDb.getConnection()
};
