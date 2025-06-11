import React, { useState } from 'react';
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

function App() {
  const [email, setEmail] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [otp, setOtp] = useState('');
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false); 
  const [errorMessage, setErrorMessage] = useState('');
  const [showInstructions, setShowInstructions] = useState(true); 

  const handleEmailChange = (e) => setEmail(e.target.value);
  const handleDiscordIdChange = (e) => setDiscordId(e.target.value);
  const handleOtpChange = (e) => setOtp(e.target.value);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const response = await fetch('https://algo-2-466c.onrender.com/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, discordId }),
      });

      const data = await response.json();
      if (data.message === 'OTP sent successfully. Please check your email.') {
        setIsEmailSubmitted(true);
        setIsOtpSent(true);
        setShowInstructions(false); 
      } else if (data.message === 'Discord ID already linked.') {
        setErrorMessage('Discord ID already linked.');
      } else {
        setErrorMessage('Error: Please try again.');
      }
    } catch (error) {
      setErrorMessage('Error submitting email and Discord ID.');
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('https://algo-2-466c.onrender.com/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, discordId }),
      });

      const data = await response.json();
      if (data.message === 'OTP verified successfully. Redirecting to Discord!') {
       
        window.location.href = data.inviteLink;  
      } else {
        setErrorMessage('Invalid OTP. Please try again.');
      }
    } catch (error) {
      setErrorMessage('Error verifying OTP.');
    }
  };

  return (
    <div className="App">
      <h1>Join our Discord Community!</h1>

      {!isEmailSubmitted ? (
        <form onSubmit={handleEmailSubmit}>
          <input type="email" value={email} onChange={handleEmailChange} placeholder="Enter your email" required />
          <input type="text" value={discordId} onChange={handleDiscordIdChange} placeholder="Enter your Discord ID" required />
          <button type="submit">Submit</button>
          
          {/* Instruction text below the button */}
          {showInstructions && (
            <p style={{ marginTop: '10px', fontSize: '14px', color: 'gray' }}>
              Open the advanced option under **"App Settings"** and **ON "Developer Options"**.
              Click 
              <FontAwesomeIcon icon={faCog} style={{ marginRight: '5px' }} /> 
              beside your name. Copy your Discord ID.

              {/* Corrected clickable link */}
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer">
                <div>Open Discord</div>
              </a>
            </p>
          )}
        </form>
      ) : (
        <>
          {isOtpSent && (
            <form onSubmit={handleOtpSubmit}>
              <input type="text" value={otp} onChange={handleOtpChange} placeholder="Enter OTP" required />
              <button type="submit">Verify OTP</button>
            </form>
          )}
        </>
      )}

      {errorMessage && <p>{errorMessage}</p>}
    </div>
  );
}

export default App;
