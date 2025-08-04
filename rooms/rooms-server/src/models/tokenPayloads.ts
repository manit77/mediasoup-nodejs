import { AuthUserRoles } from '@rooms/rooms-models';

export interface AuthUserTokenPayload {
    type: string,
    role: AuthUserRoles
}

export interface RoomTokenPayload {
    roomId?: string;
}

export interface PeerTokenPayload {
    peerId?: string;
}
