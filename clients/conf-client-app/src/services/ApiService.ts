import { User } from '../types';
import { ConferenceAPIClient } from '@conf/conf-client';
import { ConferenceClientConfig } from '@conf/conf-client/src/models';
import { ClientConfig, ConferenceScheduledInfo, GetClientConfigResultMsg, getMsgErorr, IMsg, isMsgErorr, ParticipantInfo } from '@conf/conf-models';

export interface LoginResponse {
    user: User;
    error?: string;
}

class ApiService {
    clientConfig = new ClientConfig();
    conferenceAPIClient: ConferenceAPIClient;
    conferencesScheduled: ConferenceScheduledInfo[] = [];
    participantsOnline: ParticipantInfo[] = [];
    startFetchConferencesScheduledTimerId = null;
    startFetchGetParticipantsOnlineTimerId = null;

    onConferencesReceived = (conferences: ConferenceScheduledInfo[]) => { };
    onParticipantsOnlineReceived = (participants: ParticipantInfo[]) => { };
    onError = (error: string) => { console.error(error) };

    init(config: ConferenceClientConfig) {
        this.conferenceAPIClient = new ConferenceAPIClient(config);
    }

    dispose = () => {
        if (this.startFetchGetParticipantsOnlineTimerId) {
            clearInterval(this.startFetchGetParticipantsOnlineTimerId);
        }
        if (this.startFetchConferencesScheduledTimerId) {
            clearInterval(this.startFetchConferencesScheduledTimerId);
        }
    };

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
            if (!loginResult) {
                this.onError(`login failed to get response from server.`);
                return {
                    error: `login failed to get response from server.`
                } as LoginResponse;
            }

            if (loginResult.error) {
                this.onError(`login failed: ${loginResult.error}`);
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
            this.onError(err);
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
                this.onError(`login guest failed: ${loginResult.error}`);
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
            this.onError(err);
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
                this.onError("Failed to parse stored user");
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
                this.onError(error);
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
        let error = getMsgErorr(result);
        if (error) {
            this.onError(error);
            return;
        }

        this.clientConfig = result.data.config;
        return result;
    }

    fetchParticipantsOnline = async (): Promise<ParticipantInfo[]> => {
        try {
            //console.log("ApiService fetchConferencesScheduled, clientData:", this.getClientData());

            if (!this.conferenceAPIClient) {
                this.onError("conferenceAPIClient not initialized");
                return;
            }

            let user = this.getUser();
            if (!user?.authToken) {
                this.onError("user is not authenticated.");
                return;
            }
            let result = await this.conferenceAPIClient.getParticipantsOnline(user.authToken, user.username, this.getClientData());

            if (result.error) {
                this.onError(result.error);
                return this.participantsOnline;
            }

            this.participantsOnline = result.data.participants;
            this.onParticipantsOnlineReceived(this.participantsOnline);

            return this.participantsOnline;
        } catch (err) {
            this.onError(err);
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
                this.onError(`conferenceAPIClient not initialized.`);
                return;
            }

            let user = this.getUser();

            if (!user?.authToken) {
                this.onError("user is not authenticated.");
                return;
            }

            //get conference rooms from API
            let result = await this.conferenceAPIClient.getConferencesScheduled(user.authToken, this.getClientData());

            if (isMsgErorr(result)) {
                this.onError(result?.error ?? "unknown");
                return this.conferencesScheduled;
            }

            this.conferencesScheduled = result.data.conferences;
            this.onConferencesReceived(this.conferencesScheduled);

            return this.conferencesScheduled;
        } catch (err) {
            this.onError(err);
            return [];
        }
    };

    fetchConferenceScheduled = async (trackingId: string): Promise<ConferenceScheduledInfo> => {
        try {
            console.log("ApiService fetchConferenceScheduled, clientData:", this.getClientData());

            if (!this.conferenceAPIClient) {
                this.onError(`conferenceAPIClient not initialized.`);
                return;
            }

            let user = this.getUser();

            if (!user?.authToken) {
                this.onError("user is not authenticated.");
                return;
            }
            
            let result = await this.conferenceAPIClient.getConferenceScheduled(user.authToken, trackingId, this.getClientData());

            if (isMsgErorr(result)) {
                this.onError(result?.error ?? "unknown");
                return null
            }

            return result.data.conference
        } catch (err) {
            this.onError(err);
            return null;
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