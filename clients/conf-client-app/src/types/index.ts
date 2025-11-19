export interface User {
    username: string;
    participantGroup: string;
    participantGroupName: string;
    conferenceGroup: string;
    displayName: string;
    role: "admin" | "user" | "guest" | "monitor";
    authToken: string;
    clientData: {};
}
