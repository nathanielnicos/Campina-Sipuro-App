const mysql = require('mysql2/promise');

const isLocalhost = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';

const sipuroDb = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sipuro_db',
  port: process.env.DB_PORT || 3306,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00'
});

module.exports = {
  sipuroDb,
  query: (...args) => sipuroDb.query(...args),
  execute: (...args) => sipuroDb.execute(...args),
  getConnection: () => sipuroDb.getConnection()
};
