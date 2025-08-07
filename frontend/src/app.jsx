import React, { useState } from 'react';
import './app.css';
import { Mail, Send, Sparkles, User, Key, Settings, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const EmailGenerator = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [formData, setFormData] = useState({
    prompt: '',
    groqApiKey: '',
    recipients: [''],
    senderEmail: '',
    senderPassword: '',
    smtpServer: 'smtp.gmail.com',
    smtpPort: 587
  });
  const [generatedEmail, setGeneratedEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRecipientChange = (index, value) => {
    const newRecipients = [...formData.recipients];
    newRecipients[index] = value;
    setFormData(prev => ({ ...prev, recipients: newRecipients }));
  };

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, '']
    }));
  };

  const removeRecipient = (index) => {
    if (formData.recipients.length > 1) {
      const newRecipients = formData.recipients.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, recipients: newRecipients }));
    }
  };

  const generateEmail = async () => {
    if (!formData.prompt.trim() || !formData.groqApiKey.trim()) {
      showNotification('Please provide both a prompt and Groq API key', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: formData.prompt,
          groq_api_key: formData.groqApiKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedEmail(data);
      setActiveTab('preview');
      showNotification('Email generated successfully!');
    } catch (error) {
      console.error('Error generating email:', error);
      showNotification('Failed to generate email. Please check your API key and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!generatedEmail) return;
    
    const validRecipients = formData.recipients.filter(email => email.trim());
    if (validRecipients.length === 0) {
      showNotification('Please add at least one recipient email', 'error');
      return;
    }

    if (!formData.senderEmail || !formData.senderPassword) {
      showNotification('Please provide sender email and password', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/send-email-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: validRecipients,
          subject: generatedEmail.subject,
          content: generatedEmail.content,
          sender_email: formData.senderEmail,
          sender_password: formData.senderPassword,
          smtp_server: formData.smtpServer,
          smtp_port: formData.smtpPort
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send email');
      }

      const data = await response.json();
      showNotification(`Email sent successfully to ${data.sent_to.length} recipient(s)!`);
    } catch (error) {
      console.error('Error sending email:', error);
      showNotification(error.message || 'Failed to send email', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-l-4 ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-400 text-green-700' 
            : 'bg-red-50 border-red-400 text-red-700'
        } transform transition-all duration-300 ease-in-out`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? 
              <CheckCircle className="w-5 h-5" /> : 
              <AlertCircle className="w-5 h-5" />
            }
            {notification.message}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Email Generator
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Create professional emails with AI assistance</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl p-1 shadow-lg border border-gray-200">
            {[
              { id: 'generate', label: 'Generate', icon: Sparkles },
              { id: 'preview', label: 'Preview', icon: Mail },
              { id: 'send', label: 'Send', icon: Send }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate AI Email</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Key className="w-4 h-4" />
                    Groq API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your Groq API key..."
                    value={formData.groqApiKey}
                    onChange={(e) => handleInputChange('groqApiKey', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4" />
                    Email Prompt
                  </label>
                  <textarea
                    placeholder="Describe the email you want to generate... (e.g., 'Write a follow-up email to a client about project status')"
                    value={formData.prompt}
                    onChange={(e) => handleInputChange('prompt', e.target.value)}
                    rows="6"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                <button
                  onClick={generateEmail}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Email
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Email Preview</h2>
              
              {generatedEmail ? (
                <div className="space-y-6">
                  <div className="p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700">Subject:</label>
                      <div className="mt-1 p-3 bg-white rounded-lg border">
                        {generatedEmail.subject}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700">Content:</label>
                      <div className="mt-1 p-4 bg-white rounded-lg border whitespace-pre-wrap text-gray-800 leading-relaxed">
                        {generatedEmail.content}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveTab('generate')}
                      className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
                    >
                      Edit Prompt
                    </button>
                    <button
                      onClick={() => setActiveTab('send')}
                      className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-600 hover:to-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Continue to Send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No email generated yet. Go to Generate tab to create one.</p>
                </div>
              )}
            </div>
          )}

          {/* Send Tab */}
          {activeTab === 'send' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Send Email</h2>
              
              {generatedEmail ? (
                <div className="space-y-6">
                  {/* Recipients */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                      <User className="w-4 h-4" />
                      Recipients
                    </label>
                    {formData.recipients.map((recipient, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="email"
                          placeholder="recipient@example.com"
                          value={recipient}
                          onChange={(e) => handleRecipientChange(index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {formData.recipients.length > 1 && (
                          <button
                            onClick={() => removeRecipient(index)}
                            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addRecipient}
                      className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                    >
                      + Add Another Recipient
                    </button>
                  </div>

                  {/* SMTP Settings */}
                  <div className="bg-gray-50 p-6 rounded-xl">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-4">
                      <Settings className="w-4 h-4" />
                      SMTP Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Sender Email</label>
                        <input
                          type="email"
                          placeholder="your-email@gmail.com"
                          value={formData.senderEmail}
                          onChange={(e) => handleInputChange('senderEmail', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">App Password</label>
                        <input
                          type="password"
                          placeholder="Your app password"
                          value={formData.senderPassword}
                          onChange={(e) => handleInputChange('senderPassword', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">SMTP Server</label>
                        <input
                          type="text"
                          value={formData.smtpServer}
                          onChange={(e) => handleInputChange('smtpServer', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">SMTP Port</label>
                        <input
                          type="number"
                          value={formData.smtpPort}
                          onChange={(e) => handleInputChange('smtpPort', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={sendEmail}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-4 px-6 rounded-lg font-semibold hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Generate an email first before sending.</p>
                  <button
                    onClick={() => setActiveTab('generate')}
                    className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-all"
                  >
                    Go to Generate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500">
          <p>Powered by Groq AI • Built with React</p>
        </div>
      </div>
    </div>
  );
};

export default EmailGenerator;