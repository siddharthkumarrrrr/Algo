import express from 'express';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Client } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config(); 

const app = express();
const port = 3000;


app.use(cors());
app.use(bodyParser.json());


const client = new Client({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});


client.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err) => console.error('Database connection error', err));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/check-user', async (req, res) => {
  
  const { email, discordId } = req.body;

  if (!email || !discordId) {
    return res.status(400).json({ message: 'Email and Discord ID are required' });
  }
 
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      if (user.discord_id) {
        return res.status(200).json({ message: 'Discord ID already linked.' });
      } else {
        const otp = crypto.randomInt(100000, 999999).toString(); // Generate OTP

        await client.query('UPDATE users SET otp = $1 WHERE email = $2', [otp, email]);

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
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error checking user or sending OTP:', error);
    res.status(500).json({ message: 'Failed to check user or send OTP' });
  }
});


app.post('/verify-otp', async (req, res) => {
  const { email, otp, discordId } = req.body;

  if (!email || !otp || !discordId) {
    return res.status(400).json({ message: 'Email, OTP, and Discord ID are required' });
  }

  try {
    
    const result = await client.query('SELECT * FROM users WHERE email = $1 AND otp = $2', [email, otp]);

    if (result.rows.length > 0) {
      
      await client.query('UPDATE users SET discord_id = $1 WHERE email = $2', [discordId, email]);

      
      await client.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);

      res.status(200).json({ message: 'OTP verified successfully. Redirecting to Discord!' });
    } else {
      
      await client.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);

      res.status(400).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
