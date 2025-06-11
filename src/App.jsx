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
   const [errorType, setErrorType] = useState('');

  const handleEmailChange = (e) => setEmail(e.target.value);
  const handleDiscordIdChange = (e) => setDiscordId(e.target.value);
  const handleOtpChange = (e) => setOtp(e.target.value);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    try {
         
      const response = await fetch('https://algo-8te2.onrender.com/check-user', {
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
      setErrorMessage('Your Discord ID is already linked. <a href="https://discord.gg/g8EFTeE5" target="_blank" rel="noopener noreferrer">Join here</a> if you haven’t joined yet.');
        setErrorType('link');
      } else if(data.message==='User not found') {
        setErrorMessage('Enter Registerd Email.');
        setErrorType('other');
      }
    } catch (error) {
      setErrorMessage('Backen issue.');
      setErrorType('other');
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('https://algo-8te2.onrender.com/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, discordId }),
      });

      const data = await response.json();
      if (data.message === 'OTP verified successfully. Redirecting to Discord!') {
       
        window.location.href = data.inviteLink;  
      } else {
        setErrorMessage('Invalid OTP. Please try again.');
        setErrorType('other');
      }
    } catch (error) {
      setErrorMessage('Error verifying OTP.');
      setErrorType('other');
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
              Click 
              <FontAwesomeIcon icon={faCog} style={{ marginRight: '5px' }} />  beside your name.
              <br/>
               Open the advanced option under **"App Settings"** and **ON "Developer Options"**.
               <br/>
              Copy your Discord ID by clicking on userName;

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

      {errorMessage && errorType === 'link' && (
        <p dangerouslySetInnerHTML={{ __html: errorMessage }} />
      )}
      {errorMessage && errorType === 'other' && (
        <p>{errorMessage}</p>
      )}
    </div>
  );
}

export default App;
