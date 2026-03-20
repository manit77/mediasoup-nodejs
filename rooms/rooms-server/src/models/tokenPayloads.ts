import { AuthUserRoles } from '@rooms/rooms-models';

export enum AuthClaims {
    newAuthToken = "newAuthToken",
    createRoom = "createRoom",
    terminateRoom = "terminateRoom",
    joinRoom = "joinRoom"
}

export interface AuthUserTokenPayload {
    type: string,
    role: AuthUserRoles,
    username: string,
    claims: AuthClaims[];
    iss?: string;
    aud?: string;
}

export interface RoomTokenPayload {
    roomId: string;
    claims: AuthClaims[];
}

// export interface PeerTokenPayload {
//     peerId: string;
// }
