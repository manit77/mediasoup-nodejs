import React, {
    createContext,
    useState,
    ReactNode,
    useEffect,
    useCallback,
    useMemo
} from 'react';

import { apiService, LoginResponse } from '../services/ApiService';
import { useConfig } from '../hooks/useConfig';

import {
    ClientConfig,
    ConferenceScheduledInfo,
    GetClientConfigResultMsg,
    ParticipantInfo
} from '@conf/conf-models';

import { User } from '../types';
import { getConferenceClient } from '../services/ConferenceService';

interface APIContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    isAdmin: () => boolean;
    isUser: () => boolean;
    loginGuest: (userName: string, password: string, clientData: {}) => Promise<LoginResponse>;
    login: (username: string, password: string, clientData: {}) => Promise<LoginResponse>;
    logout: () => {};
    fetchConferencesScheduled: () => Promise<ConferenceScheduledInfo[]>;
    getCurrentUser: () => User | null;
    conferencesScheduled: ConferenceScheduledInfo[];

    fetchParticipantsOnline: () => Promise<ParticipantInfo[]>;
    participantsOnline: ParticipantInfo[];

    setConferencesScheduled: React.Dispatch<React.SetStateAction<ConferenceScheduledInfo[]>>;
    getClientData: () => {};
    clearClientData: () => void;
    fetchClientConfig: (clientData: {}) => Promise<GetClientConfigResultMsg>;
    getClientConfig: () => ClientConfig;
}

export const APIContext = createContext<APIContextType | undefined>(undefined);

export const APIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { config } = useConfig();

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [conferencesScheduled, setConferencesScheduled] = useState<ConferenceScheduledInfo[]>(apiService.conferencesScheduled);
    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>(apiService.participantsOnline);

    const getCurrentUser = useCallback(() => apiService.getUser(), []);
    const getClientData = useCallback(() => apiService.getClientData(), []);
    const clearClientData = useCallback(() => apiService.clearClientData(), []);

    const isAdmin = useCallback(() => {
        const user = apiService.getUser();
        return user?.role === "admin";
    }, []);

    const isUser = useCallback(() => {
        const user = apiService.getUser();
        return user?.role === "user" || user?.role === "admin";
    }, []);

    const loginBase = async (
        action: () => Promise<LoginResponse>
    ): Promise<LoginResponse> => {
        try {
            setIsLoading(true);
            const result = await action();

            if (!result || result.error) {
                setIsAuthenticated(false);
                return result;
            }

            setIsAuthenticated(true);
            return result;

        } catch (err) {
            console.error(err);
            return { user: null, error: "login failed. server connection error." };
        } finally {
            setIsLoading(false);
        }
    };

    const loginGuest = useCallback(async (username: string, password: string, clientData: any) => {
        return loginBase(async () => {
            const local = getClientData() ?? {};
            Object.assign(local, clientData ?? {});
            return apiService.loginGuest(username, password, local);
        });
    }, [getClientData]);

    const login = useCallback(async (username: string, password: string, clientData: any) => {
        return loginBase(() => apiService.login(username, password, clientData ?? {}));
    }, []);

    const logout = useCallback(async () => {
        try {
            setIsLoading(true);
            getConferenceClient().disconnect();
            return apiService.logout();
        } finally {
            setIsAuthenticated(false);
            setIsLoading(false);
        }
    }, []);

    const fetchConferencesScheduled = useCallback(async () => {
        return apiService.fetchConferencesScheduled();
    }, []);

    const fetchParticipantsOnline = useCallback(async () => {
        return apiService.fetchParticipantsOnline();
    }, []);

    const fetchClientConfig = useCallback(async (clientData: {}) => {
        return apiService.fetchClientConfig(clientData);
    }, []);

    const getClientConfig = useCallback(() => {
        return apiService.clientConfig;
    }, []);

    const setUpConnections = useCallback(() => {
        console.log("setUpConnections");

        apiService.onConferencesReceived = (conferences) => {
            setConferencesScheduled(conferences);
        };

        apiService.onParticipantsOnlineReceived = (participants) => {
            setParticipantsOnline(participants);
        };

        apiService.onError = (error: string) => {
            console.error("apiService.onError ", error);

            const user = apiService.getUser();
            if (!user) {
                console.error("not logged in");
                setIsAuthenticated(false);
            }
        }

        const user = apiService.getUser();
        if (!user) {
            console.error("not logged in");
            return;
        }

        getConferenceClient().connect(
            user.participantGroup,
            user.conferenceGroup,
            user.username,
            user.authToken,
            user.clientData
        );

        fetchConferencesScheduled();
        apiService.startFetchConferencesScheduled();

        fetchParticipantsOnline();
        apiService.startFetchParticipantsOnline();

    }, [fetchConferencesScheduled, fetchParticipantsOnline]);


    useEffect(() => {
        const user = apiService.getUser();
        const loggedIn = Boolean(user);
        setIsAuthenticated(loggedIn);

        if (loggedIn) {
            setUpConnections();
        }
    }, [isAuthenticated]);

    const value = useMemo(() => ({
        conferencesScheduled,
        getCurrentUser,
        isAuthenticated,
        isAdmin,
        isUser,
        isLoading,

        loginGuest,
        login,
        logout,

        fetchConferencesScheduled,
        setConferencesScheduled,

        participantsOnline,
        fetchParticipantsOnline,

        getClientData,
        clearClientData,

        fetchClientConfig,
        getClientConfig,

    }), [
        conferencesScheduled,
        participantsOnline,

        getCurrentUser,
        isAuthenticated,
        isAdmin,
        isUser,
        isLoading,

        loginGuest,
        login,
        logout,

        fetchConferencesScheduled,
        fetchParticipantsOnline,

        getClientData,
        clearClientData,

        fetchClientConfig,
        getClientConfig
    ]);

    return (
        <APIContext.Provider value={value}>
            {children}
        </APIContext.Provider>
    );
};
