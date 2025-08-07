import React, { useState } from 'react';
import './app.css';
import axios from 'axios';

function EmailGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [recipients, setRecipients] = useState(['']);
  const [subject, setSubject] = useState('');
  const [isSending, setIsSending] = useState(false);

  const generateEmail = async () => {
    try {
      const response = await axios.post('http://localhost:8000/generate-email', {
        prompt: prompt,
      });
      setGeneratedEmail(response.data.email);
    } catch (error) {
      console.error('Error generating email:', error);
    }
  };

  const sendEmail = async () => {
    setIsSending(true);
    try {
      const response = await axios.post('http://localhost:8000/send-email', {
        to: recipients,
        subject: subject,
        body: generatedEmail,
      });
      alert(response.data.message);
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleRecipientChange = (index, value) => {
    const updatedRecipients = [...recipients];
    updatedRecipients[index] = value;
    setRecipients(updatedRecipients);
  };

  const addRecipientField = () => {
    setRecipients([...recipients, '']);
  };

  return (
    <div className="email-generator-container">
      <h2>AI Email Generator</h2>

      <textarea
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows="4"
        className="prompt-input"
      />

      <button onClick={generateEmail} className="generate-btn">
        Generate Email
      </button>

      <div className="recipients-section">
        <h4>Recipients:</h4>
        {recipients.map((email, index) => (
          <input
            key={index}
            type="email"
            value={email}
            onChange={(e) => handleRecipientChange(index, e.target.value)}
            placeholder={`Recipient ${index + 1}`}
            className="recipient-input"
          />
        ))}
        <button onClick={addRecipientField} className="add-recipient-btn">
          + Add Recipient
        </button>
      </div>

      <input
        type="text"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="subject-input"
      />

      <div className="email-output-container">
        <h3>Generated Email:</h3>
        <textarea
          value={generatedEmail}
          onChange={(e) => setGeneratedEmail(e.target.value)}
          rows="10"
          className="generated-email"
        />

        <div>
          <button
            onClick={sendEmail}
            disabled={isSending || !generatedEmail.trim() || recipients.every(r => !r.trim())}
            className="send-btn"
          >
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailGenerator;
