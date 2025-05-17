export enum AuthUserRoles {
    admin, user
}

export interface AuthUserTokenPayload {
    role: AuthUserRoles
}

export interface RoomTokenPayload {    
    roomId?: string;
}

export interface PeerTokenPayload {
    peerId?: string;    
}
