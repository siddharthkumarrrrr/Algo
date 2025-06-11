import express from 'express';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Client } from 'pg';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';

dotenv.config();


const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());


const dbClient = new Client({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});


dbClient.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err) => console.error('Database connection error', err));


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const discordClient = new DiscordClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});


discordClient.once('ready', () => {
  console.log('Discord bot is ready!');
});

discordClient.on('guildMemberAdd', async (member) => {
  try {
    const discordId = member.id;

    
    const result = await dbClient.query('SELECT * FROM users WHERE discord_id = $1', [discordId]);

    if (result.rows.length > 0) {
      
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

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const result = await dbClient.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      if (user.discord_id) {
        return res.status(200).json({ message: 'Discord ID already linked.' });
      } else {
        const otp = crypto.randomInt(100000, 999999).toString();
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
      await dbClient.query('INSERT INTO users (email) VALUES ($1)', [email]);
      res.status(200).json({ message: 'User created with email. Please check your email for OTP.' });
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


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


discordClient.login(process.env.DISCORD_BOT_TOKEN);
