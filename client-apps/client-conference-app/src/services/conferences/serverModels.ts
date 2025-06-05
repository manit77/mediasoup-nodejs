//server side models
export interface ConferenceModel {
    conferenceId : number, //primary key
    leaderId: number //user that created the conference
    isRecorded: boolean,
    maxParticipants: number,
    dateStart: Date,
    dateEnd: Date    
}

export interface Contact {
    contactId : string, //unique identifier of the contact, normally from the primary key
    serverId: string
    displayName: string,
    status: "online" | "offline",
}

