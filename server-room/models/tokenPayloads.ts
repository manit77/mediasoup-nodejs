export enum AuthUserRoles {
    admin = "admin"
    , user = "user"
}

export interface AuthUserTokenPayload {
    role: AuthUserRoles,
    trackingId: string
}

export interface RoomTokenPayload {
    roomId?: string;
    trackingId?: string
}

export interface PeerTokenPayload {
    peerId?: string;
    trackingId?: string
}
