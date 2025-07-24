import React, { createContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { ConferenceRoomScheduled, User } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { apiService, LoginResponse } from '../services/ApiService';
import { useConfig } from '../hooks/useConfig';

interface APIContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    isAdmin: () => boolean;
    isUser: () => boolean;
    loginGuest: (displayName: string) => Promise<LoginResponse>;
    login: (username: string, password: string) => Promise<LoginResponse>;
    logout: () => Promise<void>;
    fetchConferencesScheduled: () => Promise<ConferenceRoomScheduled[]>;
    getCurrentUser: () => User | null;
    conferencesScheduled: ConferenceRoomScheduled[];
    setConferencesScheduled: React.Dispatch<React.SetStateAction<ConferenceRoomScheduled[]>>;
}

export const APIContext = createContext<APIContextType | undefined>(undefined);

export const APIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    let { config } = useConfig();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [conferencesScheduled, setConferencesScheduled] = useState<ConferenceRoomScheduled[]>(apiService.conferencesScheduled);

    useEffect(() => {
        apiService.init(config);
    }, [config]);

    const getCurrentUser = useCallback((): User | null => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser) as User;
                return user;
            } catch (error) {
                console.error("Failed to parse stored user", error);
            }
        }
        return null;
    }, []);

    const isAdmin = useCallback((): boolean => {
        const user = getCurrentUser();
        if (user) {
            return user.role === "admin";
        }
        return false;
    }, [getCurrentUser]);

    const isUser = useCallback((): boolean => {
        const user = getCurrentUser();
        if (user) {
            return user.role === "user" || user.role === "admin";
        }
        return false;
    }, [getCurrentUser]);

    useEffect(() => {
        console.log("AuthProvider triggered.");
        let currentUser = getCurrentUser();
        if (currentUser) {
            console.log("user found.");
            setIsAuthenticated(true);
            setUpConnections();
            return;
        } else {
            console.log("user not found. ");
        }
        setIsAuthenticated(false);
    }, [getCurrentUser]);

    const loginGuest = useCallback(async (displayName: string) => {
        console.log("loginGuest");
        try {
            setIsLoading(true);
            const loginResult = await apiService.loginGuest(displayName);

            if (loginResult.error) {
                setIsAuthenticated(false);
                console.error(loginResult.error);
                return loginResult;
            }
            console.log("authenticated");
            setIsAuthenticated(true);
            setIsLoading(false);
            return loginResult;
        } catch (error) {
            setIsLoading(false);
            console.error('Login failed:', error);
            let errorResponse: LoginResponse = {
                user: null,
                error: "login failed. server connection error."
            }
            return errorResponse;
        }
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        try {
            setIsLoading(true);
            const loginResult = await apiService.login(username, password);

            if (loginResult.error) {
                setIsAuthenticated(false);
                console.error(loginResult.error);
                return loginResult;
            }
            setIsAuthenticated(true);
            setIsLoading(false);
            return loginResult;
        } catch (error) {
            setIsLoading(false);
            console.error('Login failed:', error);
            let errorResponse: LoginResponse = {
                user: null,
                error: "login failed. server connection error."
            }
            return errorResponse;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            setIsLoading(true);
            webRTCService.disconnectSignaling("user clicked logout"); // Disconnect signaling on logout            
            await apiService.logout();
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Logout failed:', error);
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            throw error;
        }
    }, []);

    const fetchConferencesScheduled = useCallback(async (): Promise<ConferenceRoomScheduled[]> => {
        console.log("fetchConferencesScheduled");
        let conferences = await apiService.fetchConferencesScheduled();
        setConferencesScheduled(conferences);
        return conferences;
    }, []);

    const setUpConnections = useCallback(() => {
        console.log(`setUpConnections`);

        let user = apiService.getUser();
        if (user) {
            webRTCService.connectSignaling(user);
            fetchConferencesScheduled();
            apiService.startFetchConferencesScheduled();
        }
    }, [fetchConferencesScheduled]);

    useEffect(() => {
        if (isAuthenticated) {
            setUpConnections();
        }
    }, [isAuthenticated, setUpConnections]);

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
        setConferencesScheduled
    }), [conferencesScheduled, getCurrentUser, isAuthenticated, isAdmin, isUser, isLoading, loginGuest, login, logout, fetchConferencesScheduled]);

    return (
        <APIContext.Provider value={value}>
            {children}
        </APIContext.Provider>
    );
};