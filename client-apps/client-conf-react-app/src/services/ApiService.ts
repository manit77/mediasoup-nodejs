import { LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
import { User, ConferenceRoomScheduled } from '../types';

const API_BASE_URL = 'https://localhost:3100';

interface LoginResponse {
    user: User;
    error?: string;
}

class ApiService {
    conferencesScheduled: ConferenceRoomScheduled[] = [];

    login = async (username: string, password: string): Promise<LoginResponse> => {

        console.warn(`login ${username}`);
        if (!username.trim()) {
            throw new Error('username name cannot be empty.');
        }

        if (!password.trim()) {
            throw new Error('password name cannot be empty.');
        }

        let postMsg = new LoginMsg();
        postMsg.data.username = username;
        postMsg.data.password = password;

        const response = await fetch(`${API_BASE_URL}${WebRoutes.login}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postMsg),
        });

        let loginResult = await response.json() as LoginResultMsg;
        console.warn(`loginResult`, loginResult);

        if (loginResult.data.error) {
            console.error(`login failed: ${loginResult.data.error}`);
            return {
                error: loginResult.data.error
            } as LoginResponse;
        }

        let result: LoginResponse = {
            user: {
                username: loginResult.data.username,
                displayName: loginResult.data.displayName,
                role: loginResult.data.role as any,
                authToken: loginResult.data.authToken
            }
        }

        console.warn(`LoginResponse`, result);

        localStorage.setItem('user', JSON.stringify(result.user));

        return result;

    };

    loginGuest = async (displayName: string): Promise<LoginResponse> => {
        console.warn(`loginGuest ${displayName}`);
        if (!displayName.trim()) {
            throw new Error('Display name cannot be empty.');
        }

        let postMsg = new LoginGuestMsg();
        postMsg.data.displayName = displayName;

        const response = await fetch(`${API_BASE_URL}${WebRoutes.loginGuest}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postMsg),
        });

        let loginResult = await response.json() as LoginResultMsg;
        console.warn(`loginResult`, loginResult);

        if (loginResult.data.error) {
            console.error(`login guest failed: ${loginResult.data.error}`);
            return {
                error: loginResult.data.error
            } as LoginResponse;
        }

        let result: LoginResponse = {
            user: {
                username: loginResult.data.username,
                displayName: loginResult.data.displayName,
                role: loginResult.data.role as any,
                authToken: loginResult.data.authToken
            }
        }

        console.warn(`LoginResponse`, result);

        localStorage.setItem('user', JSON.stringify(result.user));

        return result;
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