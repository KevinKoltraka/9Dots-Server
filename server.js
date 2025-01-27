const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const pool = require('./db');  // Import the database connection pool

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());  // To parse JSON request bodies

// Set up Multer for file handling
const upload = multer({ dest: 'uploads/' });  // Files will be stored in 'uploads' folder

const { EMAIL, PASSWORD, TO_EMAIL } = process.env;
if (!EMAIL || !PASSWORD || !TO_EMAIL) {
  console.error("Missing environment variables. Please ensure EMAIL, PASSWORD, and TO_EMAIL are set in the .env file.");
  process.exit(1);
}

// Set up the email transporter using nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL,
    pass: PASSWORD,
  },
});

// POST route for sending emails
app.post('/send-email', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please fill all the fields.' });
  }

  const mailOptions = {
    from: EMAIL,
    to: TO_EMAIL,
    subject: `New Message from ${name}`,
    text: `You have a new message from ${name} (${email}): \n\n${message}`,
    replyTo: email,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ error: 'Error sending email.' });
    }
    return res.status(200).json({ message: 'Email sent successfully!' });
  });
});

// POST route for posting a new job (with database integration)
app.post('/post-job', upload.single('companyLogo'), async (req, res) => {
  const { title, description, location, salary, requirements, companyName, deadline, employmentType, jobCategory, skills } = req.body;
  const parsedSkills = Array.isArray(skills) ? skills : skills.split(',').map(skill => skill.trim());

  if (!title || !description || !location || !salary || !companyName || !deadline || !jobCategory || !parsedSkills) {
    return res.status(400).json({ error: 'Please provide all required job information.' });
  }

  try {
    // Insert the new job posting into the database
    const [result] = await pool.execute(
      `INSERT INTO job_postings (title, description, location, salary, requirements, company_name, deadline, employmentType, jobCategory, skills, companyLogo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, description, location, salary, requirements, companyName, deadline, employmentType, jobCategory, JSON.stringify(parsedSkills), req.file ? req.file.filename : null
      ]
    );

    console.log('New job posting saved to database:', result);

    return res.status(200).json({ message: 'Job posted successfully!', jobId: result.insertId });
  } catch (error) {
    console.error('Error saving job posting to database:', error);
    return res.status(500).json({ error: 'Error saving job posting.' });
  }
});

// GET route for fetching posted jobs (from the database)
app.get('/jobs', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM job_postings');
    return res.status(200).json({ jobs: rows });
  } catch (error) {
    console.error('Error fetching jobs from database:', error);
    return res.status(500).json({ error: 'Error fetching job postings.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
