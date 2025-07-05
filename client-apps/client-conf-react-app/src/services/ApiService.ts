import { User, Conference } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'; // Configure your API base URL

interface LoginResponse {
    user: User;
    token: string; // Auth token
}

export const ApiService = {
    login: async (displayName: string): Promise<LoginResponse> => {
        // Simulate API call
        console.log(`ApiService: Logging in user ${displayName}`);
        if (!displayName.trim()) {
            throw new Error('Display name cannot be empty.');
        }
        // Replace with actual fetch call
        // const response = await fetch(`${API_BASE_URL}/auth/login`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ displayName }),
        // });
        // if (!response.ok) {
        //   const errorData = await response.json();
        //   throw new Error(errorData.message || 'Login failed');
        // }
        // return response.json() as Promise<LoginResponse>;

        // Mock implementation:
        return new Promise((resolve) => {
            setTimeout(() => {
                const user = { id: Date.now().toString(), displayName };
                localStorage.setItem('authToken', `fake-jwt-token-for-${user.id}`);
                localStorage.setItem('user', JSON.stringify(user));
                resolve({ user, token: `fake-jwt-token-for-${user.id}` });
            }, 500);
        });
    },

    logout: async (): Promise<void> => {
        // Simulate API call
        console.log('ApiService: Logging out user');
        // Replace with actual fetch call
        // const token = localStorage.getItem('authToken');
        // await fetch(`${API_BASE_URL}/auth/logout`, {
        //   method: 'POST',
        //   headers: { 'Authorization': `Bearer ${token}` },
        // });
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        return Promise.resolve();
    },

    getConferences: async (): Promise<Conference[]> => {
        //get rooms from API
        let conferences: Conference[] = [{
            id: "",
            trackingId: "1",
            name: "room1"
        }, {
            id: "",
            trackingId: "2",
            name: "room2"
        }];
        return conferences;
    }

};