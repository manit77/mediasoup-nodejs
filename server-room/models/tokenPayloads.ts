export enum AuthUserRoles {
    admin = "admin"
    , user = "user"
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
