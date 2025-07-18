import { ConferenceScheduledInfo, GetConferencesScheduledResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
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

        const response = await fetch(`${API_BASE_URL}${WebRoutes.getConferencesScheduled}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: "",
        });

        let result = await response.json() as GetConferencesScheduledResultMsg;
        if (!result.data.error) {
            return this.conferencesScheduled;
        }

        this.conferencesScheduled = result.data.conferences.map(c => ({
            id: c.id,
            roomName: c.name,
            roomDescription: c.description,
            config: {
                conferenceCode: c.config.conferenceCode,
                guestsAllowCamera: c.config.guestsAllowCamera,
                guestsAllowed: c.config.guestsAllowed,
                guestsAllowMic: c.config.guestsAllowMic,
                guestsMax: c.config.guestsMax,
                requireConferenceCode: c.config.requireConferenceCode,
                roomTimeoutSecs: c.config.roomTimeoutSecs,
                usersMax: c.config.usersMax
            }
        } as ConferenceRoomScheduled));

        return this.conferencesScheduled;
    };

};

export const apiService = new ApiService(); // Singleton instance