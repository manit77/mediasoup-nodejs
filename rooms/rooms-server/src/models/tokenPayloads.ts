import { AuthUserRoles } from '@rooms/rooms-models';

export interface AuthUserTokenPayload {
    role: AuthUserRoles
}

export interface RoomTokenPayload {
    roomId?: string;
}

export interface PeerTokenPayload {
    peerId?: string;
}
