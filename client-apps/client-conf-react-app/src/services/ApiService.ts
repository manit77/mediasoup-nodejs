import { Contact } from '@conf/conf-models';
import { User, Room } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'; // Configure your API base URL

interface LoginResponse {
    user: User;
    token: string; // Auth token
}

interface RoomTokenResponse {
    token: string; // Token for WebRTC service (e.g., Twilio, Agora, or your own)
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

    getRoomToken: async (roomId: string, userId: string): Promise<RoomTokenResponse> => {
        console.log(`ApiService: Getting room token for room ${roomId}, user ${userId}`);
        // Replace with actual fetch call
        // const token = localStorage.getItem('authToken');
        // const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/token?userId=${userId}`, {
        //   headers: { 'Authorization': `Bearer ${token}` },
        // });
        // if (!response.ok) throw new Error('Failed to get room token');
        // return response.json() as Promise<RoomTokenResponse>;

        // Mock implementation:
        return Promise.resolve({ token: `fake-room-token-for-${roomId}` });
    },

    createRoom: async (roomName: string): Promise<Room> => {
        console.log(`ApiService: Creating room ${roomName}`);
        // Replace with actual fetch call
        // const token = localStorage.getItem('authToken');
        // const response = await fetch(`${API_BASE_URL}/rooms`, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${token}`
        //   },
        //   body: JSON.stringify({ roomName }),
        // });
        // if (!response.ok) throw new Error('Failed to create room');
        // return response.json() as Promise<Room>;

        // Mock implementation:
        const newRoom = { id: `room-${Date.now()}`, name: roomName };
        return Promise.resolve(newRoom);
    },

};