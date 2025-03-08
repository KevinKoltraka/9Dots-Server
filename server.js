const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const nodemailer = require('nodemailer');

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// CORS configuration (keep your existing settings)
app.use(cors({
  origin: [
    'https://www.9dotsagency.com',
    'https://9dotsagency.com'
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.options('*', cors());

// Middleware
app.use(express.json());

// Email transporter (keep your existing configuration)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Application endpoint
app.post('/send-application', upload.single('cv'), async (req, res) => {
  try {
    const { salary, jobTitle, applicantEmail } = req.body;
    const cvFile = req.file;

    if (!cvFile) {
      return res.status(400).json({ error: 'No CV file uploaded' });
    }

    const mailOptions = {
      from: `"Job Applications" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: applicantEmail,
      subject: `New Application for ${jobTitle}`,
      text: `
        Job Title: ${jobTitle}
        Applicant Email: ${applicantEmail}
        Expected Salary: $${salary}
      `,
      html: `
        <h2>New Job Application</h2>
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
    res.status(200).json({ message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Error processing application:', error);
    res.status(500).json({ error: 'Failed to process application' });
  }
});


// Email endpoint
app.post('/send-email', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    // Send email
    await transporter.sendMail({
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: email,
      subject: 'New Message from Contact Form',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong> ${message}</p>
      `
    });

    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));