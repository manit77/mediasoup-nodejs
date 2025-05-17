import { randomUUID } from "crypto";
import * as jwt from '../utils/jwtUtil';
import { Room } from "./room";
import { AuthUserRoles, AuthUserTokenPayload, RoomTokenPayload } from "../models/tokenPayloads";

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
        if (!payload.roomId) {
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
export function createRoomToken(secretKey: string, roomId: string, expiresInMinutes: number): [RoomTokenPayload, string] {
    console.log("createRoomToken() " + roomId);

    let payload: RoomTokenPayload = {
        roomId: !roomId ? GetRoomId() : roomId
    };
    return [payload, jwt.jwtSign(secretKey, payload, expiresInMinutes)]
}


export function createAuthUserToken(secretKey: string, role: AuthUserRoles, expiresInMinutes: number): string {
    console.log("createRoomToken() ");

    let payload: AuthUserTokenPayload = {
        role: role
    };

    return jwt.jwtSign(secretKey, payload, expiresInMinutes)
}