//mimic a scenario where many clients connect and disconnect

import { RoomConfig } from "packages/shared-models/rooms-models/dist/roomsSharedModels.js";
import { RoomServer, RoomServerConfig } from "../roomServer/roomServer.js";
import { generateRoomToken } from "../roomServer/utils.js";
import { getENV } from "../utils/env.js";

//four peers join the room at different times
let testScenariosRoom1 = [
    {
        registerPeer: 1000,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 1010,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 10100,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 10100,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    }, {
        registerPeer: 10100,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    }
]

let testScenariosRoom2 = [
    {
        registerPeer: 1000,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 1010,
        getRoomToken: 1500,
        joinRoom: 1000,
    }
]

let testScenariosRoom3 = []

let testScenariosRoom4 = [
    {
        registerPeer: 1000,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 2000,
        getRoomToken: 1500,
        joinRoom: 1000,
    }
]

let roomsScenarios = [testScenariosRoom1, testScenariosRoom2, testScenariosRoom3, testScenariosRoom4];

let config = await getENV("") as RoomServerConfig;

config = {
    room_maxRoomDurationMinutes: 2,
    room_peer_timeOutInactivitySecs: 30,
    room_newRoomTokenExpiresInMinutes: 1,
    room_timeOutNoParticipantsSecs: 1    // after 1 minute, if there are no participants the room will lose
} as RoomServerConfig;


let roomServer = new RoomServer(config)

roomsScenarios = [testScenariosRoom3];

for (let roomS of roomsScenarios) {

    let roomConf = new RoomConfig();
    roomConf.maxPeers = 2;
    roomConf.maxRoomDurationMinutes = 1;
    roomConf.newRoomTokenExpiresInMinutes = 1
    let [payload, roomToken] = generateRoomToken(config.room_secretKey, "", roomConf.newRoomTokenExpiresInMinutes, "");

    let room = await roomServer.createRoom(payload.roomId, roomToken, roomConf);
    roomS.forEach(element => {

    });
}

