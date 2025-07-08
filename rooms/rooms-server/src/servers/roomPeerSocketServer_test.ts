import { Server as MockWebSocketServer, WebSocket as MockWebSocket } from 'mock-socket';
import { RoomServer, RoomServerConfig } from '../roomServer/roomServer.js';
import { defaultPeerSocketServerSecurityMap, RoomPeerSocketSecurityMap, RoomPeerSocketServer } from './roomPeerSocketServer.js';
import { getENV } from '../utils/env.js';
import {
  AuthUserNewTokenMsg, payloadTypeServer, RegisterPeerMsg, RegisterPeerResultMsg
  , RoomConfig, RoomJoinMsg, RoomLeaveMsg, RoomNewMsg, RoomNewTokenMsg, RoomNewTokenResultMsg
} from "@rooms/rooms-models";
import { MockWorker } from '../test/mediasoupMock.js';
import { Room } from '../roomServer/room.js';
import { Peer } from '../roomServer/peer.js';
import { checkKeysExist } from '../utils/utils.js';
import { vi, describe, it, test, beforeAll, afterAll, expect } from 'vitest';

// Mock the entire 'mediasoup' module
vi.mock('mediasoup', () => ({
  // The 'createWorker' function is the one you want to mock
  createWorker: vi.fn().mockImplementation(() => {
    console.log("mock createWorker");
    // Return a Promise that resolves with an instance of your MockWorker
    return Promise.resolve(new MockWorker());
  })
}));

describe('RoomPeerSocketServer', () => {
  let roomServer: RoomServer;
  let config: RoomServerConfig;
  let securityMap: RoomPeerSocketSecurityMap = defaultPeerSocketServerSecurityMap;
  let mockWSServer: MockWebSocketServer;
  let peerSocketServer: RoomPeerSocketServer;
  let testResults = {}

  beforeAll(async () => {
    console.log('### beforeAll');

    // Initialize configuration and RoomServer
    config = await getENV('') as any;
    roomServer = new RoomServer(config);

    await roomServer.init();

    // Create mock WebSocket server
    mockWSServer = new MockWebSocketServer('ws://localhost:8080');

    // Initialize peerSocketServer with mock server
    peerSocketServer = new RoomPeerSocketServer(config, securityMap, roomServer);
    await peerSocketServer.init(mockWSServer as any);

  });

  afterAll(() => {

    let arr = [payloadTypeServer.registerPeerResult,
    payloadTypeServer.roomNewTokenResult,
    payloadTypeServer.roomNewResult,
    payloadTypeServer.roomJoinResult,
    payloadTypeServer.roomLeaveResult];

    expect(checkKeysExist(testResults, arr)).toBeTruthy();

  });

  test('register', (done: any) => {
    return new Promise((resolve, reject) => {
      let authToken = "";
      let peerId = "";
      let trackingId = "peer1";
      let roomId = "";
      let roomToken = "";
      let room: Room;
      let peer: Peer;

      // Create a mock client
      const mockWS = new MockWebSocket('ws://localhost:8080');

      mockWS.addEventListener('open', async () => {
        console.log('mockWS open');
        expect(mockWS.readyState).toBe(MockWebSocket.OPEN);

        // Get auth token
        const authUserNewTokenMsg = new AuthUserNewTokenMsg();
        authUserNewTokenMsg.data.expiresInMin = 5;
        const authUserNewTokenResult = await roomServer.onAuthUserNewTokenMsg(authUserNewTokenMsg);
        console.log(authUserNewTokenResult.data.expiresIn);

        authToken = authUserNewTokenResult.data.authToken;
        // Create and send register message
        const registerMsg = new RegisterPeerMsg();
        registerMsg.data.authToken = authToken;

        // Send the message as a string
        mockWS.send(JSON.stringify(registerMsg));

      });

      mockWS.addEventListener("message", (event: any) => {
        let msgIn = JSON.parse(event.data);
        switch (msgIn.type) {
          case payloadTypeServer.registerPeerResult: {
            testResults[payloadTypeServer.registerPeerResult] = true;

            let registerPeerResultMsg = msgIn as RegisterPeerResultMsg;
            console.log(`registerResult peerId: ${registerPeerResultMsg.data.peerId} `);
            peerId = registerPeerResultMsg.data.peerId;

            //create new room token
            let roomNewTokenMsg = new RoomNewTokenMsg();
            roomNewTokenMsg.data.authToken = authToken;

            mockWS.send(JSON.stringify(roomNewTokenMsg));


            break;
          }
          case payloadTypeServer.roomNewTokenResult: {

            testResults[payloadTypeServer.roomNewTokenResult] = true;

            let msg = msgIn as RoomNewTokenResultMsg;
            roomId = msg.data.roomId;
            roomToken = msg.data.roomToken;

            console.log(`roomNewTokenResult ${roomId} ${roomToken} `);

            //create a room
            let roomNewMsg = new RoomNewMsg();
            roomNewMsg.data.peerId = peerId;
            roomNewMsg.data.roomConfig = new RoomConfig();
            roomNewMsg.data.roomId = roomId;
            roomNewMsg.data.roomToken = roomToken;

            mockWS.send(JSON.stringify(roomNewMsg));

            break;

          }
          case payloadTypeServer.roomNewResult: {
            testResults[payloadTypeServer.roomNewResult] = true;
            console.log("new room created");

            room = roomServer.getRoom(roomId);
            expect(room).toBeTruthy();

            //join room
            let roomJoinMsg = new RoomJoinMsg();
            roomJoinMsg.data.peerId = peerId;
            roomJoinMsg.data.roomId = roomId;
            roomJoinMsg.data.roomToken = roomToken;

            mockWS.send(JSON.stringify(roomJoinMsg));

            break;
          }
          case payloadTypeServer.roomJoinResult: {

            testResults[payloadTypeServer.roomJoinResult] = true;

            console.log("joined room");
            expect(room.getPeerCount()).toBeGreaterThan(0);

            peer = room.getPeer(peerId);
            expect(peer).toBeTruthy();

            //leave room
            let roomLeaveMsg = new RoomLeaveMsg();
            roomLeaveMsg.data.peerId = peerId;
            roomLeaveMsg.data.roomId = roomId;
            roomLeaveMsg.data.roomToken = roomToken;

            mockWS.send(JSON.stringify(roomLeaveMsg));
            console.log("left room");
            break;
          }
          case payloadTypeServer.roomLeaveResult: {

            testResults[payloadTypeServer.roomLeaveResult] = true;
            mockWS.close();
            mockWSServer.stop();
            roomServer.dispose();
            resolve(true);
          }
        }

      });

      // Handle errors to prevent test hanging
      mockWS.addEventListener('error', (err) => {
        console.error('Client error:', err);
        reject(err);
      });
    });

  });
});