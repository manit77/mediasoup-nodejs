import { ConferenceClientConfig } from "@conf/conf-client/src/models";

declare global {
  // eslint-disable-next-line no-var
  var __confConfig: ConferenceClientConfig | undefined;
}


export function setConferenceConfig(config: ConferenceClientConfig) {
  if (globalThis.__confConfig) {
    throw new Error('Config has already been set');
  }
  globalThis.__confConfig = config;
}

export function getConferenceConfig() {
  if (!globalThis.__confConfig) {
    throw new Error('Config not loaded yet');
  }
  return globalThis.__confConfig;
}

export async function loadConferenceConfig(): Promise<ConferenceClientConfig> {
  try {
    const response = await fetch(`${process.env.PUBLIC_URL || ''}/config.json`);
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }
    const config = await response.json() as ConferenceClientConfig;
    setConferenceConfig(config);
    return config;
  } catch (error) {
    throw error;
  }
}



