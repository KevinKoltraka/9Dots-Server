// server.js (Node.js backend)
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.set('trust proxy', 1);
const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "https://www.9dotsagency.com"
// server.js - Replace CORS configuration with:
app.use(cors({
  origin: [
    'https://www.9dotsagency.com',
    'https://9dotsagency.com' // Non-www version
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type' , 'Authorization'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.options('*', cors());
app.use(express.json());

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Use your email service (e.g., 'Outlook', 'Yahoo')
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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