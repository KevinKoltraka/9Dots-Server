const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const nodemailer = require('nodemailer');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://www.9dotsagency.com',
    'https://9dotsagency.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Baggage',  // Add these headers
    'Sentry-Trace'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

// Application endpoint
app.post('/send-application', upload.single('cv'), async (req, res) => {
  try {
    const { salary, jobTitle, applicantEmail } = req.body;
    const cvFile = req.file;

    if (!cvFile) return res.status(400).json({ error: 'No CV file uploaded' });

    const mailOptions = {
      from: `"Career Portal" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `New Application: ${jobTitle}`,
      html: `
        <h3>Job Application Details</h3>
        <p><strong>Position:</strong> ${jobTitle}</p>
        <p><strong>Applicant Email:</strong> ${applicantEmail}</p>
        <p><strong>Expected Salary:</strong> $${salary}</p>
      `,
      attachments: [{
        filename: cvFile.originalname,
        content: cvFile.buffer
      }]
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Application received successfully' });
  } catch (error) {
    console.error('Application Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Contact form endpoint
app.post('/send-email', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    await transporter.sendMail({
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: 'New Contact Form Submission',
      html: `
        <h3>Contact Details</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong> ${message}</p>
      `
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Contact Form Error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));