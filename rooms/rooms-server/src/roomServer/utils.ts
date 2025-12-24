import * as mediasoup from 'mediasoup';
import { randomUUID } from "crypto";
import * as jwt from '../utils/jwtUtil.js';
import { Room } from "./room.js";
import { AuthClaims, AuthUserTokenPayload, RoomTokenPayload } from "../models/tokenPayloads.js";
import { AuthUserRoles } from '@rooms/rooms-models';
import { consoleWarn } from '../utils/utils.js';
import { RoomServerConfig } from './models.js';
import { Producer } from 'mediasoup/types';
import { Consumer } from 'mediasoup-client/types';

/**
 * generates a unique roomId
 * @returns
 */
export function GetRoomId() {
    return "room-" + randomUUID().toString();
}

/**
 * generates a unique peerId
 * @returns
 */
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

export function decodeAuthUserToken(secretKey: string, token: string): AuthUserTokenPayload {
    try {

        if (!secretKey) {
            console.error("decodeAuthUserToken: no secret key.");
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

export function getClaimsByRole(role: AuthUserRoles): AuthClaims[] {
    let claims: AuthClaims[] = [];
    switch (role) {
        case AuthUserRoles.service:
            claims.push(AuthClaims.newAuthToken);
            claims.push(AuthClaims.createRoom);
            claims.push(AuthClaims.terminateRoom);
        break;
        case AuthUserRoles.admin:
            claims.push(AuthClaims.createRoom);
            claims.push(AuthClaims.joinRoom);
            break;
        case AuthUserRoles.user:            
            claims.push(AuthClaims.joinRoom);
            break;
        case AuthUserRoles.guest:
            claims.push(AuthClaims.joinRoom);
            break;
    }
    return claims;
}

/**
  * create a roomToken, if no roomid is specified, then generate a new roomId
  * @param roomId 
  * @returns 
  */
export function generateRoomToken(secretKey: string, roomId: string, expiresInMinutes: number, claims: AuthClaims[]): [RoomTokenPayload, string] {
    console.log("createRoomToken() ");

    let payload: RoomTokenPayload = {
        roomId: roomId,
        claims: claims
    };
    return [payload, jwt.jwtSign(secretKey, payload, expiresInMinutes)]
}

export function generateAuthUserToken(secretKey: string, username: string, role: AuthUserRoles, claims: AuthClaims[], expiresInMinutes: number): string {
    console.log("createRoomToken() ");

    let payload: AuthUserTokenPayload = {
        type: "user",
        role: role,
        username: username,
        claims: claims
    };

    return jwt.jwtSign(secretKey, payload, expiresInMinutes)
}

/**
 * creates a transport for the peer, can be a consumer or producer
 * @returns
 */
export async function createWebRtcTransport(router: mediasoup.types.Router, listeningIP: string, publicIP: string, minPort: number, maxPort: number) {
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

let recURIIndex = 0;
export function getNextRecURI(config: RoomServerConfig) {
    let url = config.rec_servers_uris[recURIIndex];
    recURIIndex++;
    if (recURIIndex >= config.rec_servers_uris.length) {
        recURIIndex = 0;
    }
    return url;
}


const CHECK_INTERVAL_MS = 3000; // Check every 3 seconds
export function startProducerMonitor(producers: Producer[]) {
    const intervalId = setInterval(async () => {
        console.log("--- Checking Producer Stats ---");

        for (const producer of producers) {
            try {
                const stats = await producer.getStats();

                const inboundRtpStat = stats.find(s => s.type === 'inbound-rtp');

                if (inboundRtpStat) {
                    if (inboundRtpStat.packetCount > 0) {
                        console.log(
                            `${producer.id} ${producer.kind}`,
                            `byteCount: ${inboundRtpStat.byteCount},`,
                            `Packets Received: ${inboundRtpStat.packetCount}`,
                            `bitrate: ${inboundRtpStat.bitrate}`
                        );
                    } else {
                        console.log(
                            `${producer.id} ${producer.kind} Producer is connected but no media flow (yet).`
                        );
                    }
                } else {
                    console.log(`❌ ${producer.id} ${producer.kind} Producer stat not found.`);
                    clearInterval(intervalId);
                }
            } catch (error) {
                console.error(`Error getting stats for ${producer.id} ${producer.kind} Producer:`, error);
                clearInterval(intervalId);
            }
        }
    }, CHECK_INTERVAL_MS);
}

export function startConsumerMonitor(consumers: Consumer[]) {
    const intervalId = setInterval(async () => {
        console.log("--- Checking Producer Stats ---");

        for (const consumer of consumers) {
            try {
                const stats = await consumer.getStats();
                const outboundRtpStat = [...stats.values()].find(s => s.type === 'outbound-rtp');

                if (outboundRtpStat) {
                    if (outboundRtpStat.packetCount > 0) {
                        console.log(
                            `${consumer.id} ${consumer.kind}`,
                            `byteCount: ${outboundRtpStat.byteCount},`,
                            `Packets Received: ${outboundRtpStat.packetCount}`,
                            `bitrate: ${outboundRtpStat.bitrate}`
                        );
                    } else {
                        console.log(
                            `${consumer.id} ${consumer.kind} consumer is connected but no media flow (yet).`
                        );
                    }
                } else {
                    console.log(`❌ ${consumer.id} ${consumer.kind} consumer stat not found.`);
                    clearInterval(intervalId);
                }
            } catch (error) {
                console.error(`Error getting stats for ${consumer.id} ${consumer.kind} consumer:`, error);
                clearInterval(intervalId);
            }
        }
    }, CHECK_INTERVAL_MS);
}
