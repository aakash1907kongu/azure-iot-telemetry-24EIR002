import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './App.css';
import AzureWeb from './azure_web';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AzureWeb />
  </React.StrictMode>
);

reportWebVitals();
