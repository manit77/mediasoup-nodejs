import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { Conference, User } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { ApiService } from '../services/ApiService';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (displayName: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    getConferences: () => Promise<Conference[]>;
    getCurrentUser: () => User | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

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

    const login = async (displayName: string, password: string) => {
        try {
            setIsLoading(true);
            const { user } = await ApiService.login(displayName, password);
            setIsAuthenticated(true);
            webRTCService.connectSignaling(user);
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Login failed:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            setIsLoading(true);
            webRTCService.disconnectSignaling(); // Disconnect signaling on logout
            webRTCService.dispose();
            await ApiService.logout();
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
    };

    const getConferences = async (): Promise<Conference[]> => {
        let conferences = await ApiService.getConferences();
        return conferences;
    }

    const getCurrentUser = (): User | null => {
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
    }

    return (
        <AuthContext.Provider value={{ getCurrentUser, isAuthenticated, isLoading, login, logout, getConferences }}>
            {children}
        </AuthContext.Provider>
    );
};