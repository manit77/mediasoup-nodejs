import { ConferenceClientConfig } from "@conf/conf-client/src/models";

export let confConfig: ConferenceClientConfig = null;

export function setConferenceConfig(config: ConferenceClientConfig) {
    if (confConfig) {
        throw new Error('Config has already been set');
    }
    confConfig = config;
}

export function getConferenceConfig() {
    if (!confConfig) {
        throw new Error('Config not loaded yet');
    }
    return confConfig;
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

