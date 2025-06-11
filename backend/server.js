import express from 'express';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Client } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Client setup
const client = new Client({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

// Connect to the database
client.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err) => console.error('Database connection error', err));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Step 1: Check if user exists and send OTP if Discord ID is missing
app.post('/check-user', async (req, res) => {
  const { email, discordId } = req.body;

  if (!email || !discordId) {
    return res.status(400).json({ message: 'Email and Discord ID are required' });
  }

  try {
    // Check if the user exists with the provided email
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      // User exists, check if Discord ID is already linked
      const user = result.rows[0];

      if (user.discord_id) {
        // Discord ID already linked, skip OTP and confirm user already linked
        return res.status(200).json({ message: 'Discord ID already linked.' });
      } else {
        // Discord ID does not exist, generate OTP and send to email
        const otp = crypto.randomInt(100000, 999999).toString(); // Generate OTP

        // Store OTP in database (not in memory)
        await client.query('UPDATE users SET otp = $1 WHERE email = $2', [otp, email]);

        // Send OTP to the user's email
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Your OTP to Join Discord Community',
          text: `Your OTP is ${otp}`,
          html: `<h3>Your OTP to join our Discord community is:</h3><p><strong>${otp}</strong></p>`,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully. Please check your email.' });
      }
    } else {
      // User does not exist, return error message
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error checking user or sending OTP:', error);
    res.status(500).json({ message: 'Failed to check user or send OTP' });
  }
});

// Step 2: Verify OTP and update Discord ID
app.post('/verify-otp', async (req, res) => {
  const { email, otp, discordId } = req.body;

  if (!email || !otp || !discordId) {
    return res.status(400).json({ message: 'Email, OTP, and Discord ID are required' });
  }

  try {
    // Verify OTP from the database
    const result = await client.query('SELECT * FROM users WHERE email = $1 AND otp = $2', [email, otp]);

    if (result.rows.length > 0) {
      // OTP is correct, update the Discord ID
      await client.query('UPDATE users SET discord_id = $1 WHERE email = $2', [discordId, email]);

      // Clear OTP after successful verification
      await client.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);

      res.status(200).json({ message: 'OTP verified successfully. Redirecting to Discord!' });
    } else {
      // Invalid OTP, clear any stored OTP
      await client.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);

      res.status(400).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
