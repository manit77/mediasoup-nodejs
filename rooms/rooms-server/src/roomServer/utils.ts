import * as mediasoup from 'mediasoup';
import { randomUUID } from "crypto";
import * as jwt from '../utils/jwtUtil.js';
import { Room } from "./room.js";
import { AuthUserTokenPayload, RoomTokenPayload } from "../models/tokenPayloads.js";
import { AuthUserRoles } from '@rooms/rooms-models';
import { consoleWarn } from '../utils/utils.js';

export function GetRoomId() {
    return "room-" + randomUUID().toString();
}

export function GetPeerId() {
    return "peer-" + randomUUID().toString();
}

export function validateRoomToken(secretKey: string, token: string): RoomTokenPayload {
    try {

        if (!secretKey) {
            console.error("no secret key.");
            return null;
        }

        if (!token) {
            console.error("no token.");
            return null;
        }

        // Verify and decode the token
        const payload = jwt.jwtVerify(secretKey, token) as RoomTokenPayload;

        // Check if roomId exists in the payload
        if (!payload || !payload.roomId) {
            console.error("invalid payload: roomId field not found");
            return null;
        }

        // Token is valid
        return payload;
    } catch (error) {
        // Handle JWT verification errors (e.g., invalid signature, malformed token)
        console.error(error);
    }

    return null;
}

export function validateAuthUserToken(secretKey: string, token: string): AuthUserTokenPayload {
    try {

        if (!secretKey) {
            console.error("no secret key.");
            return null;
        }

        if (!token) {
            console.error("no token.");
            return null;
        }

        // Verify and decode the token
        const payload = jwt.jwtVerify(secretKey, token) as AuthUserTokenPayload;

        // Check if roomId exists in the payload
        if (!payload.role) {
            console.error("invalid payload: role not found");
            return null;
        }

        // Token is valid
        return payload;
    } catch (error) {
        // Handle JWT verification errors (e.g., invalid signature, malformed token)
        console.error(error);
    }

    return null;
}

export function validateRoomTokenAgainstRoom(secretKey: string, token: string, room: Room) {

    let payload = validateRoomToken(secretKey, token);
    if (!payload) {
        console.error("invalid token.");
        return false;
    }

    if (room.id !== payload.roomId) {
        console.error("roomid does not match token.");
        return false;
    }

    return true;

}

/**
  * create a roomToken, if no roomid is specified, then generate a new roomId
  * @param roomId 
  * @returns 
  */
export function generateRoomToken(secretKey: string, expiresInMinutes: number): [RoomTokenPayload, string] {
    console.log("createRoomToken() ");

    let payload: RoomTokenPayload = {
        roomId: GetRoomId()
    };
    return [payload, jwt.jwtSign(secretKey, payload, expiresInMinutes)]
}

export function generateAuthUserToken(secretKey: string, username: string, role: AuthUserRoles, expiresInMinutes: number): string {
    console.log("createRoomToken() ");

    let payload: AuthUserTokenPayload = {
        type: "user",
        role: role,
        username: username
    };

    return jwt.jwtSign(secretKey, payload, expiresInMinutes)
}

/**
 * creates a transport for the peer, can be a consumer or producer
 * @returns
 */
export async function createTransport(router: mediasoup.types.Router, listeningIP: string, publicIP: string, minPort: number, maxPort: number) {
    consoleWarn(`createTransport() ${listeningIP} ${publicIP} ${minPort} ${maxPort}`);

    if (!router) {
        console.error("createTransport() - router is null");
        return;
    }
    try {
        return await router.createWebRtcTransport({
            listenInfos: [
                {
                    protocol: 'udp',
                    ip: listeningIP,
                    announcedIp: publicIP,
                    portRange: {
                        min: minPort,
                        max: maxPort
                    }
                }
            ],
            enableUdp: true,
            enableTcp: false,
            preferUdp: true,
        });
    } catch (err) {
        console.error("unable to generate transport.");
        console.error(err);
    }
    return null;
}
