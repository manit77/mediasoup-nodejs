import { AuthUser, ConferenceModel, Contacts } from "./serverModels";

export interface Conference {
    conferenceId : number, //primary key from ConferenceModel    
    roomId: string, //assined by the room server or unique server identifier for the call
    maxParticipants: number,
    participants : Participant[],
}

export interface AuthUser {
    authToken: string,
    userName : string
}

class ConferenceAPI {

    async login(userName: string, password: string): Promise<AuthUser> {

        //http post 
        //get authtoken
        //store to local storage
        let authUser = {
            authToken: "",
            userName: userName
        };

        return authUser;
    }

    async getConferences(): Promise<ConferenceModel[]> {

        //http post to api, with auth token header
        //return list of conferences        
        return [];
    }

    async getContacts(): Promise<Contacts[]> {

        return [];
    }

    async createConference(newConf: ConferenceModel): Promise<ConferenceModel> {

        return {} as any;
    }

    async updateConference(newConf: ConferenceModel): Promise<ConferenceModel> {

        return {} as any;
    }

    async deleteConference(conferenceId: number): Promise<boolean> {

        return {} as any;
    }

}

const conferenceAPI = new ConferenceAPI();

export default conferenceAPI;
