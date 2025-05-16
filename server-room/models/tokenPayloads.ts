export interface RoomTokenPayload {    
    roomId?: string;
    expiresIn: number; // or exp: number, depending on your JWT library
}

export interface peerTokenPayload {
    peerId?: string;    
    expiresIn: number;
}