const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config(); 


const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(bodyParser.json()); 


const { EMAIL, PASSWORD, TO_EMAIL } = process.env;
if (!EMAIL || !PASSWORD || !TO_EMAIL) {
  console.error("Missing environment variables. Please ensure EMAIL, PASSWORD, and TO_EMAIL are set in the .env file.");
  process.exit(1); 
}


const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: EMAIL,  
    pass: PASSWORD, 
  },
});


app.post('/send-email', (req, res) => {
  const { name, email, message } = req.body;

  
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please fill all the fields.' });
  }

  // Email options
  const mailOptions = {
    from: EMAIL,  
    to: TO_EMAIL, 
    subject: `New Message from ${name}`,
    text: `You have a new message from ${name} (${email}):\n\n${message}`,
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


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});