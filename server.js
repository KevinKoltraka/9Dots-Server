require('dotenv').config();  // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const mysql = require('mysql2');

const app = express();
const port = 5000;

// MySQL connection setup using environment variables from .env file
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',  // Use 'localhost' as fallback if the environment variable is not set
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Cobra.192837465',
  database: process.env.DB_DATABASE || 'job_postings',
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true',  // Convert string 'true' to boolean
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10) || 0,
});

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Endpoint to fetch job listings
app.get('/jobs', (req, res) => {
  pool.query('SELECT * FROM jobs ORDER BY id DESC', (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error fetching jobs' });
    }
    res.status(200).json({ jobs: result });
  });
});



// Endpoint to post a job
app.post('/post-job', async (req, res) => {
  const {
    title,
    description,
    location,
    salary,
    requirements,
    companyName,
    deadline,
    employmentType,
    jobCategory,
    skills,
  } = req.body;

  if (!title || !companyName) {
    return res.status(400).json({ message: 'Title and company name are required' });
  }

  const jobDeadline = deadline ? deadline : null;

  try {
    const [result] = await pool.promise().query(
      'INSERT INTO jobs (title, description, location, salary, requirements, company_name, deadline, employment_type, job_category, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title,
        description,
        location,
        salary,
        requirements,
        companyName,
        jobDeadline,
        employmentType,
        jobCategory,
        skills,
      ]
    );

    res.status(200).json({ id: result.insertId, ...req.body });
  } catch (err) {
    console.error('Error posting job:', err);
    res.status(500).send({ message: 'Error posting job', error: err.message });
  }
});



// Endpoint to delete a job
app.delete('/delete-job/:jobId', async (req, res) => {
  const jobId = req.params.jobId;

  try {
    // Delete job from the database
    await pool.promise().query('DELETE FROM jobs WHERE id = ?', [jobId]);

    res.status(200).send({ message: 'Job deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Error deleting job' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
