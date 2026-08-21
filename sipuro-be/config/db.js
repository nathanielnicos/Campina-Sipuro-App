const mysql = require('mysql2/promise');

// Pool koneksi ke Database Transaksi (sipuro_db)
const sipuroDb = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Sesuaikan dengan password MySQL Anda
  database: 'sipuro_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Pool koneksi ke Database Pusat (campina_db)
const campinaDb = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Sesuaikan dengan password MySQL Anda
  database: 'campina_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  sipuroDb,
  campinaDb
};
