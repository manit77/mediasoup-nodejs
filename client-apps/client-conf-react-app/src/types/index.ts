export interface User {
    username: string;
    displayName: string;
    role: "admin" | "user" | "guest" | "monitor";
    authToken: string;
    clientData: {};
}
