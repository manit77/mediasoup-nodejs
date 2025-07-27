import React, { createContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { ConferenceRoomScheduled, User } from '../types';
import { apiService, LoginResponse } from '../services/ApiService';
import { useConfig } from '../hooks/useConfig';
import { conferenceClient } from '@conf/conf-client';

interface APIContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    isAdmin: () => boolean;
    isUser: () => boolean;
    loginGuest: (displayName: string, clientData: {}) => Promise<LoginResponse>;
    login: (username: string, password: string, clientData: {}) => Promise<LoginResponse>;
    logout: () => {};
    fetchConferencesScheduled: () => Promise<ConferenceRoomScheduled[]>;
    getCurrentUser: () => User | null;
    conferencesScheduled: ConferenceRoomScheduled[];
    setConferencesScheduled: React.Dispatch<React.SetStateAction<ConferenceRoomScheduled[]>>;
    getClientData: () => {};
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
        return apiService.getUser();
    }, []);

    const getClientData = useCallback((): {} | null => {
        return apiService.getClientData();
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

    const loginGuest = useCallback(async (displayName: string, clientData: {}) => {
        console.log("loginGuest");
        try {
            setIsLoading(true);
            const loginResult = await apiService.loginGuest(displayName, clientData);

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

    const login = useCallback(async (username: string, password: string, clientData: {}) => {
        try {
            setIsLoading(true);
            const loginResult = await apiService.login(username, password, clientData);

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
            conferenceClient.disconnect(); // Disconnect signaling on logout            
            return apiService.logout();
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setIsAuthenticated(false);
            setIsLoading(false);
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
            conferenceClient.connect(user.username, user.authToken);
            fetchConferencesScheduled();
            apiService.startFetchConferencesScheduled();
        }
    }, [fetchConferencesScheduled]);

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
    }, [getCurrentUser, setUpConnections]);

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
        setConferencesScheduled,
        getClientData
    }), [conferencesScheduled, getCurrentUser, isAuthenticated, isAdmin, isUser, isLoading, loginGuest, login, logout, fetchConferencesScheduled, getClientData]);


    return (
        <APIContext.Provider value={value}>
            {children}
        </APIContext.Provider>
    );
};