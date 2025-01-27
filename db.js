const mysql = require('mysql2');

// Create a connection pool to the database
const pool = mysql.createPool({
  host: 'localhost',  // Use 'localhost' if MySQL is running locally
  user: 'root',  // Replace with your MySQL username
  password: 'Cobra.192837465',  // Replace with your MySQL password
  database: 'job_portal',  // The name of your database
});

// Export the pool for use in other files
module.exports = pool.promise();
