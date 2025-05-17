import { JoinMsg } from "../../server-conference/conferenceSharedModels";
import { AuthUserNewTokenMsg, RegisterMsg, RoomJoinMsg, RoomNewMsg, RoomNewTokenMsg } from "../models/roomSharedModels";
import { getENV } from "../utils/env";
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

    test("register", async () => {

        //get the access token for calling the api
        let room_access_token = config["room_access_token"];

        //ADMIN: request a new user token
        let msg = new AuthUserNewTokenMsg();
        msg.data.accessToken = room_access_token;
        msg.data.expiresInMin = 1;

        let resultNewToken = roomServer.onAuthUserNewToken(msg);
        //we should have an authtoken
        expect(resultNewToken.data.authToken).toBeTruthy();
        let authToken = resultNewToken.data.authToken;

        //USER: get new peerid
        let userTrackingId = 1; //app's unique Id
        let msgRegister = new RegisterMsg();
        msgRegister.data.authToken = authToken;
        msgRegister.data.trackingId = userTrackingId.toString();

        let resultRegister = roomServer.onRegister("", msgRegister);
        let peerId = resultRegister.data.peerId;

        //we should have a peerid
        expect(resultRegister.data.peerId).toBeTruthy();

        //ADMIN: get the a room token this requires admin access
        let roomId: string;
        let roomToken: string;
        let roomTrackingId = 1;

        let msgNewRoomToken = new RoomNewTokenMsg();
        msgNewRoomToken.data.authToken = room_access_token;
        let resultNewRoomToken = roomServer.roomNewToken(msgNewRoomToken);
        roomId = resultNewRoomToken.data.roomId
        roomToken = resultNewRoomToken.data.roomToken;

        expect(resultNewRoomToken.data.roomToken).toBeTruthy();
        expect(resultNewRoomToken.data.roomId).toBeTruthy();

        //USER: create a new room
        let newRoomMsg = new RoomNewMsg();
        newRoomMsg.data.authToken = authToken;
        newRoomMsg.data.peerId = peerId;
        newRoomMsg.data.roomId = roomId;
        newRoomMsg.data.roomToken = roomToken;

        let resultRoomNew = roomServer.onRoomNew(peerId, newRoomMsg);
        roomId = resultRoomNew.data.roomId;
        roomToken = resultRoomNew.data.roomToken;

        expect(resultRoomNew.data.roomId).toBeTruthy();
        expect(resultRoomNew.data.roomToken).toBeTruthy();

        let msgJoinRoom = new RoomJoinMsg();
        msgJoinRoom.data.authToken = authToken;
        msgJoinRoom.data.peerId = peerId;
        msgJoinRoom.data.roomId = roomId;
        msgJoinRoom.data.roomToken = roomToken;
        msgJoinRoom.data.trackingId = roomTrackingId.toString();
        
        let joinRoomResult = roomServer.onRoomJoin(peerId, msgJoinRoom);
        expect(!joinRoomResult.data.error).toBeTruthy();

        let room = roomServer.getRoom(roomId);
        let peer = roomServer.getPeer(peerId);

        expect(peer).toBeTruthy();
        expect(room).toBeTruthy();

        expect(peer.room === room).toBeTruthy();

        expect(room.peers.get(peerId) === peer).toBeTruthy();
        

    }, timeout);




});