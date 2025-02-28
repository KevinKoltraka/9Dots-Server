require("dotenv").config() // Load environment variables from .env file
const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const mysql = require("mysql2")
const bcrypt = require("bcryptjs") // For password hashing
const jwt = require("jsonwebtoken") // For generating JWT tokens
const { v4: uuidv4 } = require("uuid") // For generating refresh tokens
const nodemailer = require("nodemailer") // For sending emails

const app = express()
const port = 5000

// MySQL connection setup using environment variables from .env file
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost", // Use 'localhost' as fallback if the environment variable is not set
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Cobra.192837465",
  database: process.env.DB_DATABASE || "job_postings",
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === "true", // Convert string 'true' to boolean
  connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: Number.parseInt(process.env.DB_QUEUE_LIMIT, 10) || 0,
})

// Middleware setup
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// JWT Secret Keys
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "your_access_token_secret_key"
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret_key"

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m" // Short-lived access token
const REFRESH_TOKEN_EXPIRY = "7d" // Longer-lived refresh token

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: "gmail", // or any SMTP service
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password (consider using app-specific password for security)
  },
})

// Helper function to send an email
const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER, // From address
      to: to, // To address
      subject: subject,
      text: text, // Email content (can also be HTML)
    }

    const info = await transporter.sendMail(mailOptions)
    console.log("Email sent: " + info.response)
  } catch (error) {
    console.error("Error sending email:", error)
  }
}

// Helper function to execute MySQL queries
const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (err, results) => {
      if (err) return reject(err)
      resolve(results)
    })
  })
}

// Create refresh_tokens table if it doesn't exist
const initDatabase = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    console.log("Database initialized successfully")
  } catch (err) {
    console.error("Error initializing database:", err)
  }
}

// Initialize database on startup
initDatabase()

// Generate tokens function
const generateTokens = (user) => {
  // Generate access token
  const accessToken = jwt.sign({ id: user.id, email: user.email }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })

  // Generate refresh token
  const refreshToken = jwt.sign({ id: user.id, tokenId: uuidv4() }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  })

  return { accessToken, refreshToken }
}

// Store refresh token in database
const storeRefreshToken = async (userId, refreshToken) => {
  const decoded = jwt.decode(refreshToken)
  const expiresAt = new Date(decoded.exp * 1000)

  // Store in database
  await query("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [
    userId,
    refreshToken,
    expiresAt,
  ])
}

// Delete refresh token from database
const deleteRefreshToken = async (token) => {
  await query("DELETE FROM refresh_tokens WHERE token = ?", [token])
}

// Middleware to verify JWT token with auto-refresh
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(" ")[1]
  const refreshToken = req.headers["x-refresh-token"] || req.body.refreshToken

  if (!token) {
    return res.status(401).json({ message: "No token provided" })
  }

  try {
    // Verify the access token
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    // If token is expired and refresh token is provided
    if (err.name === "TokenExpiredError" && refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET)
        const tokens = await query("SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?", [
          refreshToken,
          decoded.id,
        ])

        if (tokens.length === 0) {
          return res.status(403).json({ message: "Invalid refresh token" })
        }

        const users = await query("SELECT * FROM users WHERE id = ?", [decoded.id])
        if (users.length === 0) {
          return res.status(403).json({ message: "User not found" })
        }
        const user = users[0]

        // Generate new tokens
        const newTokens = generateTokens(user)
        await storeRefreshToken(user.id, newTokens.refreshToken)

        res.setHeader("x-new-access-token", newTokens.accessToken)
        res.setHeader("x-new-refresh-token", newTokens.refreshToken)

        req.user = { id: user.id, email: user.email }
        next()
      } catch (err) {
        return res.status(403).json({ message: "Invalid refresh token", error: err.message })
      }
    } else {
      return res.status(403).json({ message: "Access token expired" })
    }
  }
}

// Register User
app.post("/register", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" })
  }

  try {
    // Check if user already exists
    const users = await query("SELECT * FROM users WHERE email = ?", [email])
    if (users.length > 0) {
      return res.status(400).json({ message: "User already exists" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert new user
    const result = await query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword])
    const userId = result.insertId

    // Send confirmation email to the user
    await sendEmail(
      email,
      "Welcome to Job Portal!",
      "You have successfully registered. You can now log in to your account."
    )

    res.status(201).json({ message: "User registered successfully" })
  } catch (err) {
    console.error("Error during registration:", err)
    res.status(500).json({ message: "Error registering user", error: err.message })
  }
})

// Login User
app.post("/login", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" })
  }

  try {
    // Check if user exists
    const users = await query("SELECT * FROM users WHERE email = ?", [email])
    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" })
    }
    const user = users[0]

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user)

    // Store refresh token in database
    await storeRefreshToken(user.id, refreshToken)

    res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    })
  } catch (err) {
    console.error("Error during login:", err)
    res.status(500).json({ message: "Error logging in", error: err.message })
  }
})

// Protected Route Example
app.get("/protected", async (req, res) => {
  const responseData = {
    message: "Protected route accessed",
    user: req.user,
  }

  res.status(200).json(responseData)
})

// Endpoint to fetch job listings
app.get("/jobs", (req, res) => {
  pool.query("SELECT * FROM jobs ORDER BY id DESC", (err, result) => {
    if (err) {
      return res.status(500).send({ message: "Error fetching jobs" })
    }
    res.status(200).json({ jobs: result })
  })
})

// Endpoint to post a job
app.post("/post-job", authenticateToken, async (req, res) => {
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
  } = req.body

  if (!title || !companyName) {
    return res.status(400).json({ message: "Title and company name are required" })
  }

  const jobDeadline = deadline ? deadline : null

  try {
    const [result] = await pool
      .promise()
      .query(
        "INSERT INTO jobs (title, description, location, salary, requirements, company_name, deadline, employment_type, job_category, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      )

    // Send email notification to the job poster
    const user = req.user
    await sendEmail(
      user.email, 
      "Job Posted Successfully", 
      `Your job titled "${title}" has been posted successfully! You can now manage it from your dashboard.`
    )

    res.status(200).json({
      id: result.insertId,
      ...req.body,
    })
  } catch (err) {
    console.error("Error posting job:", err)
    res.status(500).send({ message: "Error posting job", error: err.message })
  }
})
app.post("/apply-job", authenticateToken, async (req, res) => {
  const { jobId, coverLetter, resumeLink } = req.body
  const user = req.user

  if (!jobId || !coverLetter || !resumeLink) {
    return res.status(400).json({ message: "Job ID, cover letter, and resume link are required" })
  }

  try {
    // Fetch job details from the database
    const jobs = await query("SELECT * FROM jobs WHERE id = ?", [jobId])
    if (jobs.length === 0) {
      return res.status(400).json({ message: "Job not found" })
    }

    const job = jobs[0]

    // Send email to the job poster (or the hiring manager) with the application details
    const emailSubject = `New Application for ${job.title} at ${job.company_name}`
    const emailBody = `
      A new application has been submitted for the job titled "${job.title}" at "${job.company_name}".

      Applicant Email: ${user.email}
      Job ID: ${job.id}
      Cover Letter: ${coverLetter}
      Resume Link: ${resumeLink}

      Best regards,
      Job Portal`
    
    await sendEmail(
      process.env.EMAIL_USER,  // Or specify the email of the hiring manager or recruiter
      emailSubject,
      emailBody
    )

    res.status(200).json({ message: "Application submitted successfully" })
  } catch (err) {
    console.error("Error submitting application:", err)
    res.status(500).json({ message: "Error submitting application", error: err.message })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})