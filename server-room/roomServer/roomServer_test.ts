import { JoinMsg } from "../../server-conference/conferenceSharedModels";
import { AuthUserNewTokenMsg, RegisterPeerMsg, RoomJoinMsg, RoomNewMsg, RoomNewTokenMsg } from "../models/roomSharedModels";
import { getENV } from "../utils/env";
import { Peer } from "./peer";
import { Room } from "./room";
import { RoomServer, RoomServerConfig } from "./roomServer";
let timeout = 90000;

describe("roomServerTests", () => {

    let roomServer: RoomServer;
    let config: RoomServerConfig;

    beforeAll(async () => {

        config = await getENV("") as any;
        roomServer = new RoomServer(config);
        await roomServer.initMediaSoup();

    }, timeout);

    afterAll(async () => {

        roomServer.dispose();

    }, timeout);

    test("registerPeer,", async () => {

        //get the access token for calling the api
        let access_token = config["room_access_token"];
        let userTrackingId = "1"; //app's unique Id
        let authToken = "";
        let roomId: string;
        let roomToken: string;
        let roomTrackingId = "1";
        let room: Room;
        let peer: Peer;
        let displayName  = "peer1";

        //ADMIN: request a new user token

        let resultNewToken = await onAuthUserNewToken(access_token, 1, userTrackingId);
        //we should have an authtoken
        expect(resultNewToken.data.authToken).toBeTruthy();
        authToken = resultNewToken.data.authToken;

        //USER: get new peerid
        let resultRegister = await registerPeer(authToken, displayName)
        let peerId = resultRegister.data.peerId;

        //we should have a peerid
        expect(resultRegister.data.peerId).toBeTruthy();

        //ADMIN: get the a room token this requires admin access

        //create a new room token, this will return a roomId
        let resultNewRoomToken = await roomNewToken(authToken, roomTrackingId);
        roomId = resultNewRoomToken.data.roomId
        roomToken = resultNewRoomToken.data.roomToken;

        expect(resultNewRoomToken.data.roomToken).toBeTruthy();
        expect(resultNewRoomToken.data.roomId).toBeTruthy();

        //USER: create a new room, using a room access token, and roomId
        let resultRoomNew = await onRoomNew(authToken, peerId, roomId, roomToken);
        roomToken = resultRoomNew.data.roomToken;

        expect(resultRoomNew.data.roomId).toBeTruthy();
        expect(resultRoomNew.data.roomToken).toBeTruthy();
        
        let joinRoomResult = await onRoomJoin(authToken, peerId, roomId, roomToken);
        expect(!joinRoomResult.data.error).toBeTruthy();

        room = roomServer.getRoom(roomId);
        peer = roomServer.getPeer(peerId);

        expect(peer).toBeTruthy();
        expect(room).toBeTruthy();

        expect(peer.room === room).toBeTruthy();

        expect(room.peers.get(peerId) === peer).toBeTruthy();

        room.removePeer(peer.id);

        expect(room.peers.size).toBe(0);

        room.close();
        roomServer.removeRoomGlobal(room);


    }, timeout);

    async function onAuthUserNewToken(room_access_token: string, expiresInMin: number, trackingId: string) {
        //ADMIN: request a new user token
        let msg = new AuthUserNewTokenMsg();
        msg.data.authToken = room_access_token;
        msg.data.expiresInMin = expiresInMin;
        msg.data.trackingId = trackingId;

        return await roomServer.onAuthUserNewToken(msg);
    }

    async function registerPeer(authToken: string, displayName: string) {       
        //USER: get new peerid
        let msgRegister = new RegisterPeerMsg();
        msgRegister.data.authToken = authToken;
        msgRegister.data.displayName = displayName;

        return await roomServer.onRegisterPeer(msgRegister);
    }

    async function roomNewToken(room_access_token: string, trackingId: string) {

        let msgNewRoomToken = new RoomNewTokenMsg();
        msgNewRoomToken.data.authToken = room_access_token;
        msgNewRoomToken.data.trackingId = trackingId;
        return await roomServer.roomNewToken(msgNewRoomToken);

    }

    async function onRoomNew(authToken: string, peerId: string, roomId: string, roomToken: string) {

        let newRoomMsg = new RoomNewMsg();
        newRoomMsg.data.authToken = authToken;
        newRoomMsg.data.peerId = peerId;
        newRoomMsg.data.roomId = roomId;
        newRoomMsg.data.roomToken = roomToken;
        return await roomServer.onRoomNew(peerId, newRoomMsg);

    }

    async function onRoomJoin(authToken: string, peerId: string, roomId: string, roomToken: string) {

        let msgJoinRoom = new RoomJoinMsg();
        msgJoinRoom.data.authToken = authToken;
        msgJoinRoom.data.peerId = peerId;
        msgJoinRoom.data.roomId = roomId;
        msgJoinRoom.data.roomToken = roomToken;

        return await roomServer.onRoomJoin(peerId, msgJoinRoom);

    }

});