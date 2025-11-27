import { User } from '../types';
import { ConferenceAPIClient } from '@conf/conf-client';
import { ConferenceClientConfig } from '@conf/conf-client/src/models';
import { ClientConfig, ConferenceScheduledInfo, GetClientConfigResultMsg, IMsg, ParticipantInfo } from '@conf/conf-models';

export interface LoginResponse {
    user: User;
    error?: string;
}

class ApiService {
    clientConfig  = new ClientConfig();
    conferenceAPIClient: ConferenceAPIClient;
    conferencesScheduled: ConferenceScheduledInfo[] = [];
    participantsOnline: ParticipantInfo[] = [];
    startFetchConferencesScheduledTimerId = null;
    startFetchGetParticipantsOnlineTimerId = null;

    onConferencesReceived = (conferences: ConferenceScheduledInfo[]) => { };
    onParticipantsOnlineReceived = (participants: ParticipantInfo[]) => { };

    init(config: ConferenceClientConfig) {
        this.conferenceAPIClient = new ConferenceAPIClient(config);        
    }

    dispose() {
        if (this.startFetchGetParticipantsOnlineTimerId) {
            clearInterval(this.startFetchGetParticipantsOnlineTimerId);
        }
        if (this.startFetchConferencesScheduledTimerId) {
            clearInterval(this.startFetchConferencesScheduledTimerId);
        }
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
            if(!loginResult) {
                 console.error(`login failed to get response from server.`);
                return {
                    error: `login failed to get response from server.`
                } as LoginResponse;
                return;
            }

            if (loginResult.error) {
                console.error(`login failed: ${loginResult.error}`);
                return {
                    error: loginResult.error
                } as LoginResponse;
            }

            let result: LoginResponse = {
                user: {
                    participantGroup: loginResult.data.participantGroup,
                    participantGroupName: loginResult.data.participantGroupName,
                    conferenceGroup: loginResult.data.conferenceGroup,
                    username: loginResult.data.username,
                    displayName: loginResult.data.displayName,
                    role: loginResult.data.role as any,
                    authToken: loginResult.data.authToken,
                    clientData: loginResult.data.clientData
                }
            };

            console.log(`LoginResponse`, result);
            localStorage.setItem('user', JSON.stringify(result.user));
            if (loginResult.data.clientData) {
                localStorage.setItem('clientData', JSON.stringify(loginResult.data.clientData));
            }

            return result;
        } catch (err) {
            console.error(err);
        }
        return null;
    };

    loginGuest = async (username: string, password, clientData: any): Promise<LoginResponse | null> => {
        try {
            console.log(`loginGuest ${username}`);
            if (!username.trim()) {
                throw new Error('username cannot be empty.');
            }

            if (!password.trim()) {
                throw new Error('password cannot be empty.');
            }

            let loginResult = await this.conferenceAPIClient.loginGuest(username, password, clientData);
            console.log(`loginResult`, loginResult);

            if (loginResult.error) {
                console.error(`login guest failed: ${loginResult.error}`);
                return {
                    error: loginResult.error
                } as LoginResponse;
            }

            if (loginResult.data.clientData) {
                clientData = loginResult.data.clientData;
            }

            let result: LoginResponse = {
                user: {
                    participantGroup: loginResult.data.participantGroup,
                    participantGroupName: loginResult.data.participantGroupName,
                    conferenceGroup: loginResult.data.conferenceGroup,
                    username: loginResult.data.username,
                    displayName: loginResult.data.displayName,
                    role: loginResult.data.role as any,
                    authToken: loginResult.data.authToken,
                    clientData: clientData,
                }
            }

            console.log(`LoginResponse`, result);
            localStorage.setItem('user', JSON.stringify(result.user));
            if (result.user.clientData) {
                localStorage.setItem('clientData', JSON.stringify(result.user.clientData));
            }

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
        const str = localStorage.getItem('clientData');
        if (str) {
            try {
                return JSON.parse(str);
            } catch (error) {
                console.error("Failed to parse client data", error);
            }
        }
        return null;
    }

    clearClientData() {
        localStorage.removeItem("clientData");
    }

    async fetchClientConfig(clientData: any): Promise<GetClientConfigResultMsg> {
        let result = await this.conferenceAPIClient.getClientConfig(clientData);

        console.warn("fetchClientConfig", result);
        
        if(result.error) {
            console.error(result.error);
            return;            
        }

        this.clientConfig = result.data.config;
        return result;
    }

    fetchParticipantsOnline = async (): Promise<ParticipantInfo[]> => {
        try {
            //console.log("ApiService fetchConferencesScheduled, clientData:", this.getClientData());

            if (!this.conferenceAPIClient) {
                console.error(`conferenceAPIClient not initialized.`);
                return;
            }

            let user = this.getUser();
            let result = await this.conferenceAPIClient.getParticipantsOnline(user.authToken, user.username, this.getClientData());

            if (result.error) {
                console.error(`ERROR:`, result.error);
                return this.participantsOnline;
            }

            this.participantsOnline = result.data.participants;
            this.onParticipantsOnlineReceived(this.participantsOnline);

            return this.participantsOnline;
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    startFetchParticipantsOnline = async () => {

        if (this.startFetchGetParticipantsOnlineTimerId) {
            clearInterval(this.startFetchGetParticipantsOnlineTimerId);
        }

        this.startFetchGetParticipantsOnlineTimerId = setInterval(() => {
            let user = this.getUser();
            if (user) {
                this.fetchParticipantsOnline();
            }
        }, 30 * 1000);
    };

    fetchConferencesScheduled = async (): Promise<ConferenceScheduledInfo[]> => {
        try {
            //console.log("ApiService fetchConferencesScheduled, clientData:", this.getClientData());

            if (!this.conferenceAPIClient) {
                console.error(`conferenceAPIClient not initialized.`);
                return;
            }

            let user = this.getUser();
            //get rooms from API
            let result = await this.conferenceAPIClient.getConferencesScheduled(user.authToken, this.getClientData());

            if (result.error) {
                console.error(`ERROR:`, result.error);
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
            clearInterval(this.startFetchConferencesScheduledTimerId);
        }

        this.startFetchConferencesScheduledTimerId = setInterval(() => {
            let user = this.getUser();
            if (user) {
                this.fetchConferencesScheduled();
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