import React, { createContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { ConferenceRoomScheduled, User } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { apiService } from '../services/ApiService';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    loginGuest: (displayName: string) => Promise<void>;
    login: (displayName: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchConferencesScheduled: () => Promise<ConferenceRoomScheduled[]>;
    getCurrentUser: () => User | null;
    conferencesScheduled: ConferenceRoomScheduled[];
    setConferencesScheduled: React.Dispatch<React.SetStateAction<ConferenceRoomScheduled[]>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [conferencesScheduled, setConferencesScheduled] = useState<ConferenceRoomScheduled[]>(apiService.conferencesScheduled);

    useEffect(() => {
        console.log("AuthProvider triggered.");
        let currentUser = getCurrentUser();        
        if (currentUser) {
            console.log("user found.");
            setIsAuthenticated(true);
            webRTCService.connectSignaling(currentUser);
            return;
        } else {
            console.log("user not found. ");
        }
        setIsAuthenticated(false);
    }, []);

    const loginGuest = useCallback(async (displayName: string) => {
        try {
            setIsLoading(true);
            const { user } = await apiService.loginGuest(displayName);
            setIsAuthenticated(true);
            webRTCService.connectSignaling(user);
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Login failed:', error);
            throw error;
        }
    }, []);

    const login = useCallback(async (displayName: string, password: string) => {
        try {
            setIsLoading(true);
            const { user } = await apiService.login(displayName, password);
            setIsAuthenticated(true);
            webRTCService.connectSignaling(user);
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Login failed:', error);
            throw error;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            setIsLoading(true);
            webRTCService.disconnectSignaling(); // Disconnect signaling on logout
            webRTCService.dispose();
            await apiService.logout();
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Logout failed:', error);
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            throw error;
        }
    }, []);

    const fetchConferencesScheduled = useCallback(async (): Promise<ConferenceRoomScheduled[]> => {
        console.log("fetchConferencesScheduled");
        let conferences = await apiService.fetchConferencesScheduled();
        setConferencesScheduled(conferences);
        return conferences;
    }, []);

    const getCurrentUser = useCallback((): User | null => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('authToken');
        if (storedUser && token) {
            try {
                const user = JSON.parse(storedUser) as User;
                return user;
            } catch (error) {
                console.error("Failed to parse stored user", error);
            }
        }
        return null;
    }, []);

    const value = useMemo(() => ({
        conferencesScheduled,
        getCurrentUser,
        isAuthenticated,
        isLoading,
        loginGuest,
        login,
        logout,
        fetchConferencesScheduled,
        setConferencesScheduled
    }), [conferencesScheduled, getCurrentUser, isAuthenticated, isLoading, loginGuest, login, logout, fetchConferencesScheduled, setConferencesScheduled]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};