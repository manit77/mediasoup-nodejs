import { User, ConferenceRoomScheduled } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'; // Configure your API base URL

interface LoginResponse {
    user: User;
    token: string; 
    role: string;
}

class ApiService  {
    conferencesScheduled: ConferenceRoomScheduled[] = [];

    login = async (displayName: string, password: string): Promise<LoginResponse> => {
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
                const user : User = { id: Date.now().toString(), displayName, role: "admin" };
                localStorage.setItem('authToken', `fake-jwt-token-for-${user.id}`);
                localStorage.setItem('user', JSON.stringify(user));
                resolve({ user, token: `fake-jwt-token-for-${user.id}`, role: user.role });
            }, 500);
        });
    };

    loginGuest = async (displayName: string): Promise<LoginResponse> => {
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
                const user: User = { id: Date.now().toString(), displayName, role: "guest" };
                localStorage.setItem('authToken', `fake-jwt-token-for-${user.id}`);
                localStorage.setItem('user', JSON.stringify(user));
                resolve({ user, token: `fake-jwt-token-for-${user.id}`, role: user.role });
            }, 500);
        });
    };

    logout = async (): Promise<void> => {
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
    };

    fetchConferencesScheduled = async (): Promise<ConferenceRoomScheduled[]> => {
        console.log("fetchConferencesScheduled");
        //get rooms from API
        this.conferencesScheduled = [new ConferenceRoomScheduled("1", "Room 1"), new ConferenceRoomScheduled("2", "Room 2")];
        return this.conferencesScheduled;
    };

};

export const apiService = new ApiService(); // Singleton instance