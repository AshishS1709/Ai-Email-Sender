import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Optional: Tailwind or your custom CSS
import EmailGenerator from './app.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <EmailGenerator />
  </React.StrictMode>
);
