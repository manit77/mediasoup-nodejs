import 'bootstrap/dist/css/bootstrap.min.css';
import { createRoot } from 'react-dom/client';
import '@client/index.css';
import App from '@client/App';
import { loadConferenceConfig } from '@client/services/ConferenceConfig';
import { apiService } from "@client/services/ApiService";
import { ConfigProvider } from '@client/contexts/ConfigContext';
import { StrictMode } from 'react';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

let currentCommit: string | null = null;

async function checkForUpdate() {
  try {
    const res = await fetch(`/config.json?ts=${Date.now()}`, { cache: 'no-store' });
    const config = await res.json();
    if (currentCommit && currentCommit !== config.commit) {
      window.location.reload();
    }
    currentCommit = config.commit;
  } catch (err) {
    console.error('Update check failed:', err);
  }
}

async function initApp() {
  try {
    const config = await loadConferenceConfig();
    apiService.init(config);
    currentCommit = config.commit;

    root.render(
      <StrictMode>
        <ConfigProvider>
        <App />
      </ConfigProvider>
      </StrictMode>
    );

    // Visibility Listener
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    setInterval(checkForUpdate, 60 * 60 * 1000);

  } catch (error) {
    console.error('Bootstrap error:', error);
    root.render(<div style={{ color: 'red', padding: '20px' }}>Failed to load app.</div>);
  }
}

initApp();