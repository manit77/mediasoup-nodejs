import {
    AuthUserNewTokenMsg, RegisterPeerMsg, RoomConfig, RoomJoinMsg
    , RoomNewMsg, RoomNewTokenMsg
} from "@rooms/rooms-models";
import { getENV } from "../utils/env.js";
import { Peer } from "./peer.js";
import { Room } from "./room.js";
import { RoomServer, RoomServerConfig } from "./roomServer.js";
import { generateRoomToken } from "./utils.js";
import { describe, it, test, beforeAll, afterAll, expect } from 'vitest';

let timeout = 90000;

describe("roomServerTests", () => {

    let roomServer: RoomServer;
    let config: RoomServerConfig;

    beforeAll(async () => {
        console.log("### beforeAll");
        config = await getENV("") as any;
        roomServer = new RoomServer(config);
        await roomServer.init();

    }, timeout);

    afterAll(async () => {

        console.log("### afterAll");
        roomServer.dispose();
        expect(roomServer.getPeerCount()).toBe(0);
        expect(roomServer.getRoomCount()).toBe(0);

    }, timeout);

    it("createRoom", async () => {

        //send invalid token, this should not generate a room
        let room = await roomServer.createRoom({
            roomId: "",
            roomName: "room1",
            adminTrackingId: "",
            config: new RoomConfig(),
            roomToken: "",
            trackingId: ""

        });
        expect(room).toBeFalsy();

        //generate a room tokn
        let [payload, roomtoken] = generateRoomToken(config.room_secretKey, 1);
        expect(payload).toBeTruthy();

        //should not return a room, we need the roomid
        room = await roomServer.createRoom({
            roomId: "",
            roomName: "room1",
            roomToken: roomtoken,
            adminTrackingId: "",
            trackingId: "",
            config: new RoomConfig()
        });
        expect(room).toBeFalsy();

        room = await roomServer.createRoom({
            roomId: payload.roomId as string,
            roomToken: roomtoken, 
            roomName: "room1", 
            adminTrackingId: "",
            trackingId: "",
            config: new RoomConfig()
        });
        expect(room).toBeTruthy();
        room.close("test");

    });

    it("registerPeer,", async () => {

        //get the access token for calling the api        
        let userTrackingId = "1"; //app's unique Id
        let authToken = "";
        let roomId: string;
        let roomToken: string;
        let roomTrackingId = "1";
        let room: Room;
        let peer: Peer;
        let displayName = "peer1";

        //ADMIN: request a new user token

        let resultNewToken = await onAuthUserNewToken(1, userTrackingId);
        //we should have an authtoken
        expect(resultNewToken.data.authToken).toBeTruthy();
        authToken = resultNewToken.data.authToken as string;

        //USER: get new peerid
        let resultRegister = await onRegisterPeer(authToken, displayName)
        let peerId = resultRegister.data.peerId as string;

        //we should have a peerid
        expect(resultRegister.data.peerId).toBeTruthy();

        //ADMIN: get a room token

        //create a new room token, this will return a roomId
        let resultNewRoomToken = await roomNewToken();
        roomId = resultNewRoomToken.data.roomId as string
        roomToken = resultNewRoomToken.data.roomToken as string;

        expect(resultNewRoomToken.data.roomToken).toBeTruthy();
        expect(resultNewRoomToken.data.roomId).toBeTruthy();

        //USER: create a new room, using a room access token, and roomId
        let resultRoomNew = await onRoomNew(peerId, roomId, roomToken);
        roomToken = resultRoomNew.data.roomToken;

        expect(resultRoomNew.data.roomId).toBeTruthy();
        expect(resultRoomNew.data.roomToken).toBeTruthy();

        //join room
        let joinRoomResult = await onRoomJoin(peerId, roomId, roomToken);
        expect(!joinRoomResult.data.error).toBeTruthy();

        room = roomServer.getRoom(roomId);
        peer = roomServer.getPeer(peerId);

        expect(peer).toBeTruthy();
        expect(room).toBeTruthy();
        expect(peer.room === room).toBeTruthy();
        expect(room.getPeer(peerId) === peer).toBeTruthy();

        //remove the peer
        room.removePeer(peer.id);

        expect(room.getPeerCount()).toBe(0);

        //close the room
        room.close("test");


    }, timeout);

    it("multplePeers", async () => {

        let localPeers: { peerId: string, authToken: string }[] = [];
        let localRoom = {
            roomId: "",
            roomToken: ""
        };

        let numPeers = 4;
        for (let i = 0; i < numPeers; i++) {
            let authUserNewTokenRes = await onAuthUserNewToken(1, "peer_" + i.toString());
            let peerTrack = {
                peerId: "",
                authToken: authUserNewTokenRes.data.authToken as string            
            };

            localPeers.push(peerTrack);

            let res = await onRegisterPeer(peerTrack.authToken, "");
            peerTrack.peerId = res.data.peerId as string;
        }

        //create a room token        
        let roomNewTokenRes = await roomNewToken();
        localRoom.roomToken = roomNewTokenRes.data.roomToken as string;

        //create room requires a peerid, use the first peer
        let roomNewRes = await onRoomNew(localPeers[0].peerId, roomNewTokenRes.data.roomId as string, roomNewTokenRes.data.roomToken as string);
        localRoom.roomId = roomNewRes.data.roomId;
        localRoom.roomToken = roomNewRes.data.roomToken;

        //new room is created, all peers can join the room

        for (let i = 0; i < numPeers; i++) {
            let peerTrack = localPeers[i];
            await onRoomJoin(peerTrack.peerId, localRoom.roomId, localRoom.roomToken);
        }

        let room = roomServer.getRoom(localRoom.roomId);
        expect(room.getPeerCount()).toBe(numPeers);

        room.close("test");
        expect(room.getPeerCount()).toBe(0);

    }, timeout);

    async function onAuthUserNewToken(expiresInMin: number, trackingId: string) {
        //ADMIN: request a new user token
        let msg = new AuthUserNewTokenMsg();
        msg.data.expiresInMin = expiresInMin;

        return await roomServer.onAuthUserNewTokenMsg(msg);
    }

    async function onRegisterPeer(authToken: string, displayName: string) {
        //USER: get new peerid
        let msgRegister = new RegisterPeerMsg();
        msgRegister.data.authToken = authToken;
        msgRegister.data.displayName = displayName;

        return await roomServer.onRegisterPeer(msgRegister);
    }

    async function roomNewToken() {

        let msgNewRoomToken = new RoomNewTokenMsg();
        return await roomServer.onRoomNewTokenMsg(msgNewRoomToken);

    }

    async function onRoomNew(peerId: string, roomId: string, roomToken: string) {

        let newRoomMsg = new RoomNewMsg();

        newRoomMsg.data.peerId = peerId;
        newRoomMsg.data.roomId = roomId;
        newRoomMsg.data.roomToken = roomToken;
        return await roomServer.onRoomNew(peerId, newRoomMsg);

    }

    async function onRoomJoin(peerId: string, roomId: string, roomToken: string) {

        let msgJoinRoom = new RoomJoinMsg();
        //msgJoinRoom.data.authToken = authToken;
        msgJoinRoom.data.peerId = peerId;
        msgJoinRoom.data.roomId = roomId;
        msgJoinRoom.data.roomToken = roomToken;

        return await roomServer.onRoomJoin(peerId, msgJoinRoom);

    }

});