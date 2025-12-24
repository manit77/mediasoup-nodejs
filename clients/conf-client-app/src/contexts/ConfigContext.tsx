// src/context/ConfigContext.tsx
import React, { createContext, useContext } from 'react';
import { ConferenceClientConfig } from "@conf/conf-client/src/models";
import { getConferenceConfig } from '@client/services/ConferenceConfig';

interface ConfigContextType {
    config: ConferenceClientConfig;
}

export const ConfigContext = createContext<ConfigContextType>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const config = getConferenceConfig();
    return <ConfigContext.Provider value={{
        config
    }}>
        {children}</ConfigContext.Provider>;
}
