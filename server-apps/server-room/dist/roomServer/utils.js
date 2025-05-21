import { randomUUID } from "crypto";
import * as jwt from '../utils/jwtUtil';
export function GetRoomId() {
    return "room-" + randomUUID().toString();
}
export function GetPeerId() {
    return "peer-" + randomUUID().toString();
}
export function validateRoomToken(secretKey, token) {
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
        const payload = jwt.jwtVerify(secretKey, token);
        // Check if roomId exists in the payload
        if (!payload || !payload.roomId) {
            console.error("invalid payload: roomId field not found");
            return null;
        }
        // Token is valid
        return payload;
    }
    catch (error) {
        // Handle JWT verification errors (e.g., invalid signature, malformed token)
        console.error(error);
    }
    return null;
}
export function validateAuthUserToken(secretKey, token) {
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
        const payload = jwt.jwtVerify(secretKey, token);
        // Check if roomId exists in the payload
        if (!payload.role) {
            console.error("invalid payload: role not found");
            return null;
        }
        // Token is valid
        return payload;
    }
    catch (error) {
        // Handle JWT verification errors (e.g., invalid signature, malformed token)
        console.error(error);
    }
    return null;
}
export function validateRoomTokenAgainstRoom(secretKey, token, room) {
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
export function generateRoomToken(secretKey, roomId, expiresInMinutes, trackingId) {
    console.log("createRoomToken() " + roomId);
    let payload = {
        roomId: !roomId ? GetRoomId() : roomId,
        trackingId: trackingId
    };
    return [payload, jwt.jwtSign(secretKey, payload, expiresInMinutes)];
}
export function generateAuthUserToken(secretKey, role, expiresInMinutes, trackingId) {
    console.log("createRoomToken() ");
    let payload = {
        role: role,
        trackingId: trackingId
    };
    return jwt.jwtSign(secretKey, payload, expiresInMinutes);
}
/**
 * creates a transport for the peer, can be a consumer or producer
 * @returns
 */
export async function createTransport(router) {
    console.log("createTransport()");
    try {
        return await this.router.createWebRtcTransport({
            listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });
    }
    catch (err) {
        console.error("unable to generate transport.");
        console.error(err);
    }
    return null;
}
