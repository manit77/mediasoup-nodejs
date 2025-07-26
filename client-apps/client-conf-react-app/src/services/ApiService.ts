import { User, ConferenceRoomScheduled } from '../types';
import { ConferenceAPIClient } from '@conf/conf-client';
import { ConferenceClientConfig } from '@conf/conf-client/src/models';

export interface LoginResponse {
    user: User;
    error?: string;
}

class ApiService {
    conferenceAPIClient: ConferenceAPIClient;
    conferencesScheduled: ConferenceRoomScheduled[] = [];
    startFetchConferencesScheduledTimerId = null;

    init(config: ConferenceClientConfig) {
        this.conferenceAPIClient = new ConferenceAPIClient(config);
    }

    login = async (username: string, password: string, clientData: {}): Promise<LoginResponse> => {

        console.log(`login ${username}`, clientData);
        if (!username.trim()) {
            throw new Error('username name cannot be empty.');
        }

        if (!password.trim()) {
            throw new Error('password name cannot be empty.');
        }

        let loginResult = await this.conferenceAPIClient.login(username, password, clientData);

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

    loginGuest = async (displayName: string, clientData: any): Promise<LoginResponse> => {
        console.log(`loginGuest ${displayName}`);
        if (!displayName.trim()) {
            throw new Error('Display name cannot be empty.');
        }

        let loginResult = await this.conferenceAPIClient.loginGuest(displayName, clientData);
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
                clientData: this.conferenceAPIClient.clientData,
            }
        }

        console.log(`LoginResponse`, result);
        localStorage.setItem('user', JSON.stringify(result.user));
        return result;
    };

    logout = () => {
        console.log('ApiService: Logging out user');
        let clientData = this.getClientData();
        console.log(`clientData:`, clientData);
        localStorage.removeItem('user');
        return clientData;
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

    getClientData() {
        return this.getUser()?.clientData;
    }

    fetchConferencesScheduled = async (): Promise<ConferenceRoomScheduled[]> => {
        // console.log("fetchConferencesScheduled", this.conferenceAPIClient?.clientData);

        if (!this.conferenceAPIClient) {
            console.error(`conferenceAPIClient not initialized.`);
            return;
        }

        //get rooms from API
        let result = await this.conferenceAPIClient.getConferencesScheduled(this.conferenceAPIClient.clientData);

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