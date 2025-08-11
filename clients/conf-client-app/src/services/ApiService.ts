import { User } from '../types';
import { ConferenceAPIClient } from '@conf/conf-client';
import { ConferenceClientConfig } from '@conf/conf-client/src/models';
import { ConferenceScheduledInfo } from '@conf/conf-models';

export interface LoginResponse {
    user: User;
    error?: string;
}

class ApiService {
    conferenceAPIClient: ConferenceAPIClient;
    conferencesScheduled: ConferenceScheduledInfo[] = [];
    startFetchConferencesScheduledTimerId = null;

    onConferencesReceived = (conferences: ConferenceScheduledInfo[]) => { };

    init(config: ConferenceClientConfig) {
        this.conferenceAPIClient = new ConferenceAPIClient(config);
    }

    login = async (username: string, password: string, clientData: {}): Promise<LoginResponse | null> => {

        try {
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

            if (loginResult.data.clientData) {
                clientData = loginResult.data.clientData;
            }

            let result: LoginResponse = {
                user: {
                    username: loginResult.data.username,
                    displayName: loginResult.data.displayName,
                    role: loginResult.data.role as any,
                    authToken: loginResult.data.authToken,
                    clientData: clientData
                }
            }

            console.log(`LoginResponse`, result);
            localStorage.setItem('user', JSON.stringify(result.user));

            return result;
        } catch (err) {
            console.error(err);
        }
        return null;
    };

    loginGuest = async (displayName: string, clientData: any): Promise<LoginResponse | null> => {
        try {
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

            if (loginResult.data.clientData) {
                clientData = loginResult.data.clientData;
            }

            let result: LoginResponse = {
                user: {
                    username: loginResult.data.username,
                    displayName: loginResult.data.displayName,
                    role: loginResult.data.role as any,
                    authToken: loginResult.data.authToken,
                    clientData: clientData,
                }
            }

            console.warn(`LoginResponse`, result);
            localStorage.setItem('user', JSON.stringify(result.user));
            return result;
        } catch (err) {
            console.error(err);
            return null;
        }
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

    fetchConferencesScheduled = async (): Promise<ConferenceScheduledInfo[]> => {
        try {
            //console.log("fetchConferencesScheduled", this.getClientData());

            if (!this.conferenceAPIClient) {
                console.error(`conferenceAPIClient not initialized.`);
                return;
            }

            let user = this.getUser();
            //get rooms from API
            let result = await this.conferenceAPIClient.getConferencesScheduled(user.authToken, this.getClientData());
           
            if (result.data.error) {
                console.error(`ERROR:`, result.data.error);
                return this.conferencesScheduled;
            }

            this.conferencesScheduled = result.data.conferences;
            this.onConferencesReceived(this.conferencesScheduled);

            return this.conferencesScheduled;
        } catch (err) {
            console.error(err);
            return [];
        }
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
        }, 30 * 1000);
    };

};

// Tell TypeScript about our global variable so it doesn't complain
declare global {
  // eslint-disable-next-line no-var
  var __apiService: ApiService | undefined;
}

// Only create it once
if (!globalThis.__apiService) {
  globalThis.__apiService = new ApiService();
}

export const apiService = globalThis.__apiService!;