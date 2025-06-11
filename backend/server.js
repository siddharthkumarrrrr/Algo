import express from 'express';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Client } from 'pg';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';

dotenv.config();  // Load environment variables

// Express app setup
const app = express();


app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Client setup
const dbClient = new Client({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000, // 5 seconds timeout for connection
});

// Connect to the database with error handling
dbClient.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err) => {
    console.error('Database connection error:', err);
    // Optionally, you can retry the connection or handle the error more gracefully
    setTimeout(() => {
      console.log('Retrying database connection...');
      dbClient.connect();
    }, 5000); // Retry connection after 5 seconds
  });

// Handling errors during runtime (e.g., unexpected disconnect)
dbClient.on('error', (err) => {
  console.error('Database error:', err);
  // Here, you can add reconnection logic or shutdown the app gracefully
});

// Nodemailer setup for sending OTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Discord bot setup
const discordClient = new DiscordClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});


discordClient.once('ready', () => {
  console.log('Discord bot is ready!');
});

// Listen for new members joining the server
discordClient.on('guildMemberAdd', async (member) => {
  try {
    const discordId = member.id;

    // Check if the member's Discord ID exists in the database
    const result = await dbClient.query('SELECT * FROM users WHERE discord_id = $1', [discordId]);

    if (result.rows.length > 0) {
      // If the Discord ID exists in the database, assign the "Premium Member" role
      const role = member.guild.roles.cache.get(process.env.DISCORD_ROLE_ID);
      if (role) {
        await member.roles.add(role);
        console.log(`Assigned Premium Member role to ${member.user.tag}`);
      } else {
        console.log('Role not found');
      }
    } else {
      console.log(`User with Discord ID ${discordId} not found in database`);
    }
  } catch (error) {
    console.error('Error adding member:', error);
  }
});


app.post('/check-user', async (req, res) => {
  const { email, discordId } = req.body;

  if (!email || !discordId) {
    return res.status(400).json({ message: 'Email and Discord ID are required' });
  }

  try {
    const result = await dbClient.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      if (user.discord_id) {
        return res.status(200).json({ message: 'Discord ID already linked.' });
      } else {
        const otp = crypto.randomInt(100000, 999999).toString(); // Generate OTP

        // Store OTP in database (not in memory)
        await dbClient.query('UPDATE users SET otp = $1 WHERE email = $2', [otp, email]);

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
    const result = await dbClient.query('SELECT * FROM users WHERE email = $1 AND otp = $2', [email, otp]);

    if (result.rows.length > 0) {
      await dbClient.query('UPDATE users SET discord_id = $1 WHERE email = $2', [discordId, email]);

      const inviteLink = 'https://discord.gg/g8EFTeE5';  
      res.status(200).json({ message: 'OTP verified successfully. Redirecting to Discord!', inviteLink });

      // Remove OTP from the database after successful verification
      await dbClient.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);
    } else {
      await dbClient.query('UPDATE users SET otp = NULL WHERE email = $1', [email]);
      res.status(400).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
});

// Helper function to assign a role on Discord
async function assignRoleToDiscordUser(discordId) {
  const guildId = process.env.DISCORD_GUILD_ID;  
  const roleId = process.env.DISCORD_ROLE_ID;    

  try {
    const member = await discordClient.guilds.cache.get(guildId).members.fetch(discordId);
    await member.roles.add(roleId);
    console.log(`Role assigned to user: ${discordId}`);
  } catch (error) {
    console.error('Error assigning role:', error);
  }
}


const port = process.env.PORT || 8000;  
app.listen(port, () => {
  console.log(`Server running at ${port}`);
});

// Log the bot in
discordClient.login(process.env.DISCORD_BOT_TOKEN);
