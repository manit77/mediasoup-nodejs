import { ConferenceScheduledInfo, GetConferencesScheduledResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
import { User, ConferenceRoomScheduled } from '../types';
import { ConferenceAPIClient } from '@conf/conf-client';
import { conferenceClientConfig } from './ConferenceConfig';

export interface LoginResponse {
    user: User;
    error?: string;
}

class ApiService {
    conferenceAPIClient: ConferenceAPIClient = new ConferenceAPIClient(conferenceClientConfig);
    conferencesScheduled: ConferenceRoomScheduled[] = [];
    startFetchConferencesScheduledTimerId = null;

    getClientData = () => {
        return {};
    }

    login = async (username: string, password: string): Promise<LoginResponse> => {

        console.log(`login ${username}`);
        if (!username.trim()) {
            throw new Error('username name cannot be empty.');
        }

        if (!password.trim()) {
            throw new Error('password name cannot be empty.');
        }

        let loginResult = await this.conferenceAPIClient.login(username, password, this.getClientData());

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
                authToken: loginResult.data.authToken,
                clientData: loginResult.data.clientData
            }
        }

        console.log(`LoginResponse`, result);
        localStorage.setItem('user', JSON.stringify(result.user));

        return result;

    };

    loginGuest = async (displayName: string): Promise<LoginResponse> => {
        console.log(`loginGuest ${displayName}`);
        if (!displayName.trim()) {
            throw new Error('Display name cannot be empty.');
        }

        let loginResult = await this.conferenceAPIClient.loginGuest(displayName, this.getClientData());
        console.log(`loginResult`, loginResult);

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
                authToken: loginResult.data.authToken,
                clientData: loginResult.data.clientData,
            }
        }

        console.log(`LoginResponse`, result);
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

    getUser() {
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
    }

    fetchConferencesScheduled = async (): Promise<ConferenceRoomScheduled[]> => {
        //console.log("fetchConferencesScheduled");
        //get rooms from API
        let result = await this.conferenceAPIClient.getConferencesScheduled(this.getClientData());

        if (result.data.error) {
            console.error(`ERROR:`, result.data.error);
            return this.conferencesScheduled;
        }

        this.conferencesScheduled = result.data.conferences.map(c => ({
            externalId: c.externalId,
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

        //console.log(`ConferenceRoomScheduled:`, this.conferencesScheduled);

        return this.conferencesScheduled;
    };


    startFetchConferencesScheduled = () => {
        //console.log("startFetchConferencesScheduled");
        if (this.startFetchConferencesScheduledTimerId) {
            clearTimeout(this.startFetchConferencesScheduledTimerId);
        }

        this.startFetchConferencesScheduledTimerId = setTimeout(() => {
            let user = this.getUser();
            if (user) {
                this.fetchConferencesScheduled();
                this.startFetchConferencesScheduled();
            }
        }, 10 * 1000);
    };

};

export const apiService = new ApiService(); // Singleton instance