import { AuthUserRoles } from '@rooms/rooms-models';

export interface AuthUserTokenPayload {
    type: string,
    role: AuthUserRoles,
    username: string,
}

export interface RoomTokenPayload {
    roomId?: string;
}

export interface PeerTokenPayload {
    peerId?: string;
}
