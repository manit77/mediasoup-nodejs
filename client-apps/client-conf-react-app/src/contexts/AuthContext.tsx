import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { webRTCService } from '../services/WebRTCService';
import { ApiService } from '../services/ApiService';

interface AuthContextType {
    currentUser: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (displayName: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Check for existing session

    useEffect(() => {
        console.log("** AuthProvider created");

        // Check for existing session on load (e.g., from localStorage)
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('authToken');
        if (storedUser && token) {
            try {
                const user = JSON.parse(storedUser) as User;
                setCurrentUser(user);
                setIsAuthenticated(true);
                // Re-connect to signaling if authenticated
                webRTCService.connectSignaling(user);
            } catch (error) {
                console.error("Failed to parse stored user", error);
                localStorage.removeItem('user');
                localStorage.removeItem('authToken');
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (displayName: string) => {
        try {
            setIsLoading(true);
            const { user } = await ApiService.login(displayName);
            setCurrentUser(user);
            setIsAuthenticated(true);
            webRTCService.connectSignaling(user); // Connect signaling on login
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
            await ApiService.logout();
            webRTCService.disconnectSignaling(); // Disconnect signaling on logout
            setCurrentUser(null);
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            console.error('Logout failed:', error);
            // Still clear client-side state
            setCurrentUser(null);
            setIsAuthenticated(false);
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};