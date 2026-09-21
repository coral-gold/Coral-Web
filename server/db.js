'use strict';
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:               process.env.DB_HOST || 'localhost',
    user:               process.env.DB_USER || 'root',
    password:           process.env.DB_PASS || '',
    database:           process.env.DB_NAME || 'coralgold',
    waitForConnections: true,
    connectionLimit:    10,
    decimalNumbers:     true,
});

module.exports = pool;
