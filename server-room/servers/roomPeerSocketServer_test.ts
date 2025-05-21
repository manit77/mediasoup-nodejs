import { WebSocketServer, WebSocket } from 'ws';
import { Server as MockWebSocketServer, WebSocket as MockWebSocket } from 'mock-socket';
import { RoomServer, RoomServerConfig } from '../roomServer/roomServer';
import { defaultPeerSocketServerSecurityMap, RoomPeerSocketSecurityMap, RoomPeerSocketServer } from './roomPeerSocketServer';
import { getENV } from '../utils/env';
import { AuthUserNewTokenMsg, payloadTypeClient, payloadTypeServer, RegisterPeerMsg, RegisterPeerResultMsg } from '../models/roomSharedModels';
import sinon from 'sinon';
import { MockWorker } from '../test/mediasoupMock';

// Mock mediasoup module
jest.mock('mediasoup', () => ({
    createWorker: jest.fn().mockImplementation(() => {
        console.log("mock createWorker");
        return Promise.resolve(new MockWorker());
    }),
    version: '3.x.x',
}));

describe('RoomPeerSocketServer', () => {
  let roomServer: RoomServer;
  let config: RoomServerConfig;
  let securityMap: RoomPeerSocketSecurityMap = defaultPeerSocketServerSecurityMap;
  let mockWSServer: MockWebSocketServer;
  let peerSocketServer: RoomPeerSocketServer;

  beforeAll(async () => {
    jest.clearAllMocks();
    console.log('### beforeAll');

    // Initialize configuration and RoomServer
    config = await getENV('') as any;
    roomServer = new RoomServer(config);

    await roomServer.initMediaSoup();

    // Create mock WebSocket server
    mockWSServer = new MockWebSocketServer('ws://localhost:8080');

    // Initialize peerSocketServer with mock server
    peerSocketServer = new RoomPeerSocketServer(config, securityMap, roomServer);
    await peerSocketServer.initWebSocket(mockWSServer as any);

  });

  afterEach(() => {
    // Close all connections and stop the mock server
    mockWSServer.close();
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Ensure everything is cleaned up
    mockWSServer.stop();
    roomServer.dispose();
  });

  test('should receive and process register message', (done) => {
    // Spy on the onMessage method to verify it's called
    const onMessageSpy = sinon.spy(peerSocketServer, 'onMessage');

    // Create a mock client
    const mockWS = new MockWebSocket('ws://localhost:8080');
    
    mockWS.addEventListener('open', async () => {
      console.log('mockWS open');
      expect(mockWS.readyState).toBe(MockWebSocket.OPEN);

      // Get auth token
      const authUserNewTokenMsg = new AuthUserNewTokenMsg();
      const authUserNewTokenResult = await roomServer.onAuthUserNewToken(authUserNewTokenMsg);

      // Create and send register message
      const registerMsg = new RegisterPeerMsg();
      registerMsg.data.authToken = authUserNewTokenResult.data.authToken;

      // Send the message as a string
      mockWS.send(JSON.stringify(registerMsg));
     
    });

    mockWS.addEventListener("message", (event : any)=>{        
        let msgIn = JSON.parse(event.data);
        switch (msgIn.type){
            case payloadTypeServer.registerResult : {
                let registerPeerResultMsg = msgIn as RegisterPeerResultMsg;
                console.log(`registerResult peerId: ${registerPeerResultMsg.data.peerId} `)
                break;
            }

        }        
        mockWS.close();
        done();

    });

    // Handle errors to prevent test hanging
    mockWS.addEventListener('error', (err) => {
      console.error('Client error:', err);
      done(err);
    });
  });
});