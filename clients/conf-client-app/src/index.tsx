import 'bootstrap/dist/css/bootstrap.min.css';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { loadConferenceConfig } from './services/ConferenceConfig';
import { ConfigProvider } from './contexts/ConfigContext';
import React from 'react';

loadConferenceConfig().then(config => {
  console.log("config loaded", config);

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    // <React.StrictMode>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    //</React.StrictMode>
  );
}).catch(error => {
  console.error('Error loading config:', error);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<div style={{ color: 'red', textAlign: 'center' }}>Failed to load configuration.</div>);
});