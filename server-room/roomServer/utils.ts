import { randomUUID } from "crypto";
import * as jwt from '../utils/jwtUtil';
import { Room } from "./room";
import { RoomTokenPayload } from "../models/tokenPayloads";

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

        if (!payload.expiresIn) {
            console.error("invalid payload: expiresIn field not found");
            return null;
        }

        // Check expiration (if expiresIn or exp is used)
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        if (payload.expiresIn && payload.expiresIn < currentTime) {
            console.error(`token is expired`);
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
export function createRoomToken(secretKey: string, roomId: string, expiresInMinutes: number = 60): [RoomTokenPayload, string] {
    console.log("createRoomToken() " + roomId);    
    
    let payload: RoomTokenPayload = {
        roomId: !roomId ? GetRoomId() : roomId,
        expiresIn: Math.floor(Date.now() / 1000) + (expiresInMinutes * 60),
    };
    return [payload, jwt.jwtSign(secretKey, payload)]
}