import 'bootstrap/dist/css/bootstrap.min.css';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { loadConferenceConfig } from './services/ConferenceConfig';
import { ConfigProvider } from './contexts/ConfigContext';
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />

let currentCommit: string | null = null;
async function checkForUpdate() {
  try {
    console.warn('checkForUpdate');

    const res = await fetch(`/config.json?ts=${Date.now()}`, { cache: 'no-store' });
    const config = await res.json();

    if (!currentCommit) {
      currentCommit = config.commit; // store first loaded commit
    } else if (currentCommit !== config.commit) {
      console.log(
        `New version detected: ${config.commit}, reloading (was ${currentCommit})`
      );
      window.location.reload();
    }
  } catch (err) {
    console.error('Failed to check for updates:', err);
  }
}

loadConferenceConfig().then(config => {
  console.log("config loaded", config);
  currentCommit = config.commit;

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

  // Check on tab wake
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    }
  });

  setInterval(checkForUpdate, 60 * 60 * 1000);

}).catch(error => {
  console.error('Error loading config:', error);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<div style={{ color: 'red', textAlign: 'center' }}>Failed to load configuration.</div>);
});