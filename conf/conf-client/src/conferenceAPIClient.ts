import { apiGetClientConfigPost, apiGetParticipantsOnlinePost, apiGetScheduledConferencePost, apiGetScheduledConferencesPost, GetClientConfigResultMsg, GetConferenceScheduledResultMsg, GetConferencesScheduledResultMsg, GetParticipantsResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
import { ConferenceClientConfig } from './models.js';

export class ConferenceAPIClient {

    constructor(private config: ConferenceClientConfig) {

    }

    startFetchConferencesScheduledTimerId = null;

    login = async (username: string, password: string, clientData: {}): Promise<LoginResultMsg | null> => {

        try {
            console.log(`login ${username} `, clientData);
            if (!username.trim()) {
                throw new Error('username name cannot be empty.');
            }

            if (!password.trim()) {
                throw new Error('password name cannot be empty.');
            }

            let postMsg = new LoginMsg();
            postMsg.data.username = username;
            postMsg.data.password = password;
            postMsg.data.clientData = clientData;

            const response = await fetch(`${this.config.conf_server_url}${WebRoutes.login}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postMsg),
            });

            let responseText = await response.text();
            console.log(responseText);

            let loginResult = JSON.parse(responseText) as LoginResultMsg;
            console.log(`loginResult`, loginResult);

            return loginResult;
        } catch (err) {
            console.error(err)
        }
        return null;

    };

    loginGuest = async (username: string, password: string, clientData: {}): Promise<LoginResultMsg> => {
        console.log(`loginGuest ${username}`);
        try {
            if (!username.trim()) {
                throw new Error('username name cannot be empty.');
            }

            if (!password.trim()) {
                throw new Error('password name cannot be empty.');
            }

            let postMsg = new LoginGuestMsg();
            postMsg.data.username = username;
            postMsg.data.password = password;
            postMsg.data.clientData = clientData;

            const response = await fetch(`${this.config.conf_server_url}${WebRoutes.loginGuest}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postMsg),
            });

            let body = await response.text();
            let loginResult = await JSON.parse(body) as LoginResultMsg;
            console.log(`loginResult`, loginResult);

            return loginResult;
        } catch (err) {
            console.error(err);
        }
        return null;
    };

    getConferencesScheduled = async (authToken: string, clientData: {}): Promise<GetConferencesScheduledResultMsg | null> => {
        console.log("getConferencesScheduled", clientData);
        try {

            let post = new apiGetScheduledConferencesPost();
            post.data.clientData = clientData;
            //console.log("getConferencesScheduled", post);

            const response = await fetch(`${this.config.conf_server_url}${WebRoutes.getConferencesScheduled}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`

                },
                body: JSON.stringify(post),
            });

            return await response.json() as GetConferencesScheduledResultMsg;
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    getConferenceScheduled = async (authToken: string, trackingId: string, clientData: {}): Promise<GetConferenceScheduledResultMsg | null> => {
        console.log(`getConferenceScheduled ${trackingId} `, clientData);

        try {
            let post = new apiGetScheduledConferencePost();
            post.data.id = trackingId;
            post.data.clientData = clientData;

            const response = await fetch(`${this.config.conf_server_url}${WebRoutes.getConferenceScheduled}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(post),
            });

            return await response.json() as GetConferenceScheduledResultMsg;
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    getParticipantsOnline = async (authToken: string, username: string, clientData: {}): Promise<GetParticipantsResultMsg | null> => {
        console.log("getParticipantsOnline", clientData);
        try {

            let post = new apiGetParticipantsOnlinePost();
            post.data.username = username;
            post.data.clientData = clientData;

            const response = await fetch(`${this.config.conf_server_url}${WebRoutes.getParticipantsOnline}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`

                },
                body: JSON.stringify(post),
            });

            return await response.json();
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    getClientConfig = async (clientData: {}): Promise<GetClientConfigResultMsg | null> => {
        console.log("getClientConfig", clientData);

        try {
            let post = new apiGetClientConfigPost();
            post.data.clientData = clientData;

            const response = await fetch(`${this.config.conf_server_url}${WebRoutes.getClientConfig}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(post),
            });

            return await response.json();
        } catch (err) {
            console.error(err);
            return null;
        }
    };

};
