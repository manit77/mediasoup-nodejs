import { AuthUserNewTokenMsg, RegisterPeerMsg, RoomConfig, RoomJoinMsg, RoomNewMsg, RoomNewTokenMsg } from "@rooms/rooms-models";
import { getENV } from "../utils/env.js";
import { RoomServer } from "./roomServer.js";
import { generateRoomToken } from "./utils.js";
import { describe, it, expect } from 'vitest';
let timeout = 90000;
describe("roomServerTests", () => {
    let roomServer;
    let config;
    beforeAll(async () => {
        console.log("### beforeAll");
        config = await getENV("");
        roomServer = new RoomServer(config);
        await roomServer.initMediaSoup();
    }, timeout);
    afterAll(async () => {
        console.log("### afterAll");
        roomServer.dispose();
        expect(roomServer.getPeerCount()).toBe(0);
        expect(roomServer.getRoomCount()).toBe(0);
    }, timeout);
    it("createRoom", async () => {
        //send invalid token, this should not generate a room
        let room = await roomServer.createRoom("", "a", new RoomConfig());
        expect(room).toBeFalsy();
        //generate a room tokn
        let [payload, roomtoken] = generateRoomToken(config.room_secretKey, "", 1, "");
        expect(payload).toBeTruthy();
        //should not return a room, we need the roomid
        room = await roomServer.createRoom("", roomtoken, new RoomConfig());
        expect(room).toBeFalsy();
        room = await roomServer.createRoom(payload.roomId, roomtoken, new RoomConfig());
        expect(room).toBeTruthy();
        room.close();
    });
    it("registerPeer,", async () => {
        //get the access token for calling the api        
        let userTrackingId = "1"; //app's unique Id
        let authToken = "";
        let roomId;
        let roomToken;
        let roomTrackingId = "1";
        let room;
        let peer;
        let displayName = "peer1";
        //ADMIN: request a new user token
        let resultNewToken = await onAuthUserNewToken(1, userTrackingId);
        //we should have an authtoken
        expect(resultNewToken.data.authToken).toBeTruthy();
        authToken = resultNewToken.data.authToken;
        //USER: get new peerid
        let resultRegister = await onRegisterPeer(authToken, displayName);
        let peerId = resultRegister.data.peerId;
        //we should have a peerid
        expect(resultRegister.data.peerId).toBeTruthy();
        //ADMIN: get a room token
        //create a new room token, this will return a roomId
        let resultNewRoomToken = await roomNewToken(roomTrackingId);
        roomId = resultNewRoomToken.data.roomId;
        roomToken = resultNewRoomToken.data.roomToken;
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
        room.close();
    }, timeout);
    it("multplePeers", async () => {
        let localPeers = [];
        let localRoom = {
            roomId: "",
            roomToken: ""
        };
        let numPeers = 4;
        for (let i = 0; i < numPeers; i++) {
            let authUserNewTokenRes = await onAuthUserNewToken(1, "peer_" + i.toString());
            let peerTrack = {
                peerId: "",
                authToken: authUserNewTokenRes.data.authToken
            };
            localPeers.push(peerTrack);
            let res = await onRegisterPeer(peerTrack.authToken, "");
            peerTrack.peerId = res.data.peerId;
        }
        //create a room token        
        let roomNewTokenRes = await roomNewToken("room 1");
        localRoom.roomToken = roomNewTokenRes.data.roomToken;
        //create room requires a peerid, use the first peer
        let roomNewRes = await onRoomNew(localPeers[0].peerId, roomNewTokenRes.data.roomId, roomNewTokenRes.data.roomToken);
        localRoom.roomId = roomNewRes.data.roomId;
        localRoom.roomToken = roomNewRes.data.roomToken;
        //new room is created, all peers can join the room
        for (let i = 0; i < numPeers; i++) {
            let peerTrack = localPeers[i];
            await onRoomJoin(peerTrack.peerId, localRoom.roomId, localRoom.roomToken);
        }
        let room = roomServer.getRoom(localRoom.roomId);
        expect(room.getPeerCount()).toBe(numPeers);
        room.close();
        expect(room.getPeerCount()).toBe(0);
    }, timeout);
    async function onAuthUserNewToken(expiresInMin, trackingId) {
        //ADMIN: request a new user token
        let msg = new AuthUserNewTokenMsg();
        msg.data.expiresInMin = expiresInMin;
        msg.data.trackingId = trackingId;
        return await roomServer.onAuthUserNewTokenMsg(msg);
    }
    async function onRegisterPeer(authToken, displayName) {
        //USER: get new peerid
        let msgRegister = new RegisterPeerMsg();
        msgRegister.data.authToken = authToken;
        msgRegister.data.displayName = displayName;
        return await roomServer.onRegisterPeer(msgRegister);
    }
    async function roomNewToken(trackingId) {
        let msgNewRoomToken = new RoomNewTokenMsg();
        msgNewRoomToken.data.trackingId = trackingId;
        return await roomServer.onRoomNewTokenMsg(msgNewRoomToken);
    }
    async function onRoomNew(peerId, roomId, roomToken) {
        let newRoomMsg = new RoomNewMsg();
        newRoomMsg.data.peerId = peerId;
        newRoomMsg.data.roomId = roomId;
        newRoomMsg.data.roomToken = roomToken;
        return await roomServer.onRoomNew(peerId, newRoomMsg);
    }
    async function onRoomJoin(peerId, roomId, roomToken) {
        let msgJoinRoom = new RoomJoinMsg();
        //msgJoinRoom.data.authToken = authToken;
        msgJoinRoom.data.peerId = peerId;
        msgJoinRoom.data.roomId = roomId;
        msgJoinRoom.data.roomToken = roomToken;
        return await roomServer.onRoomJoin(peerId, msgJoinRoom);
    }
});
