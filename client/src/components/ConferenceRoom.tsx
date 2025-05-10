import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, LogOut, Users, MessageSquare } from 'lucide-react';
import * as mediasoupClient from 'mediasoup-client';
import { ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg, payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg, RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomPeerLeftMsg } from './payload';

interface Peer {
  id: string;
  name: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

const ConferenceRoom: React.FC = () => {
  const [localPeerId, setLocalPeerId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [localRoomId, setLocalRoomId] = useState<string>("");
  const [roomConnected, setRoomConnected] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<"grid" | "focus" | "chat">("grid");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const deviceRef = useRef<mediasoupClient.types.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const [wsURI, setwsURI] = useState<string>("");

  useEffect(() => {
    // Initialize on component mount
    console.log("ConferenceRoom useEffect");

    (async () => {
      await initMediaSoupDevice();
      await initWebSocket();
    })();


    // Cleanup on unmount
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const initMediaSoupDevice = async () => {

    if (deviceRef.current) return;

    try {
      // In real implementation, this would use the actual mediasoup-client
      deviceRef.current = new mediasoupClient.Device();
      writeLog("MediaSoup device initialized");
    } catch (error) {
      writeLog(`Error initializing MediaSoup: ${error.message}`);
    }
  };

  const initWebSocket = async () => {


    if (wsRef.current) return;

    // In a real implementation, actually connect to WebSocket
    writeLog("initWebSocket");
    const uri = "wss://localhost:3000"; // use directly to avoid stale state issue

    setwsURI(uri);

    let ws = new WebSocket(uri);
    wsRef.current = ws;
    writeLog("trying " + uri);

    ws.onopen = async () => {
      setIsConnected(true);
      writeLog("websocket open " + wsURI);
      register();
    };

    ws.onmessage = async (event) => {
      const msgIn: any = JSON.parse(event.data);

      console.log("-- ws_receive ", msgIn);

      switch (msgIn.type) {
        case payloadTypeServer.registerResult:
          onRegisterResult(msgIn);
          break;
        case payloadTypeServer.producerTransportCreated:
          onProducerTransportCreated(msgIn);
          break;
        case payloadTypeServer.consumerTransportCreated:
          onConsumerTransportCreated(msgIn);
          break;
        case payloadTypeServer.roomJoinResult:
          onRoomJoinResult(msgIn);
          break;
        case payloadTypeServer.roomNewPeer:
          onRoomNewPeer(msgIn);
          break;
        case payloadTypeServer.roomNewProducer:
          onRoomNewProducer(msgIn);
          break;
        case payloadTypeServer.roomPeerLeft:
          onRoomPeerLeft(msgIn);
          break;
        case payloadTypeServer.produced:
          onProduced(msgIn);
          break;
        case payloadTypeServer.consumed:
          onConsumed(msgIn);
          break;
      }

    };

    ws.onclose = async () => {
      writeLog("websocket closed");
      setIsConnected(false);
    };

  };

  async function send(msg: any) {
    console.log("ws_send ", msg);
    wsRef.current.send(JSON.stringify(msg));
  };

  const writeLog = (message) => {
    console.log(message);
    setLogs(prev => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev.slice(0, 9)]);
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    writeLog(`Microphone ${!audioEnabled ? 'enabled' : 'disabled'}`);
  };

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
    writeLog(`Camera ${!videoEnabled ? 'enabled' : 'disabled'}`);
  };

  const register = async () => {
    console.log("-- register");

    let msg = new RegisterMsg();
    msg.authToken = ""; //need authtoken from server
    msg.displayName = displayName;
    send(msg);
  }

  async function handleRoomJoin() {
    roomJoin(localRoomId);
  }

  async function handleRoomLeave() {
    roomLeave();
  }

  async function onRegisterResult(msgIn: RegisterResultMsg) {

    writeLog("-- onRegisterResult");

    setLocalPeerId(msgIn.data!.peerid);

    await deviceRef.current.load({ routerRtpCapabilities: msgIn.data!.rtpCapabilities });

    await createProducerTransport();
    await createConsumerTransport();

  }

  async function createProducerTransport() {
    console.log("-- createProducerTransport");
    let msg = new CreateProducerTransportMsg();
    send(msg);
  }

  async function createConsumerTransport() {
    console.log("-- createConsumerTransport");
    let msg = new CreateConsumerTransportMsg();
    send(msg);
  }

  async function roomJoin(roomid: string) {
    let msg = new RoomJoinMsg();
    msg.data = {
      roomId: roomid,
      roomToken: ""
    };
    send(msg);
  }

  async function roomLeave() {
    let msg = new RoomLeaveMsg();
    msg.data = {
      roomId: localRoomId,
      roomToken: ""
    };

    setRoomConnected(false);
    setLocalRoomId("");

    send(msg);

  }

  function isInRoom() {
    return !!roomConnected;
  }

  async function addTrackToRemoteVideo(peerId: string, kind: string, track: MediaStreamTrack) {

    let peer = peers.find(p => p.id === peerId);

    if (kind === "video") {
      peer.hasVideo = true;    
    } else if (kind === "audioo") {
      peer.hasVideo = true;     
    }

    // Find the existing video element
    let video = document.getElementById(peerId) as HTMLVideoElement | null;

    if (!video) {
      //add new element
      video = document.createElement('video');
      video.id = peerId;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = '300px';
      video.srcObject = new MediaStream([track]);
    }

    // Get the current MediaStream or create a new one if none exists
    let mediaStream = video.srcObject as MediaStream;
    if (!mediaStream) {
      mediaStream = new MediaStream();
      video.srcObject = mediaStream;
    }

    // Add the new track to the MediaStream
    mediaStream.addTrack(track);

    // Ensure the video is set to play
    video.play().catch(error => {
      console.error('Error playing video:', error);
    });

    setPeers(peers);


  }

  async function onConsumerTransportCreated(msgIn: ConsumerTransportCreatedMsg) {
    console.log("-- onConsumerTransportCreated");

    recvTransportRef.current = deviceRef.current.createRecvTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data!.iceServers,
      iceCandidates: msgIn.data!.iceCandidates,
      iceParameters: msgIn.data!.iceParameters,
      dtlsParameters: msgIn.data!.dtlsParameters,
      iceTransportPolicy: msgIn.data!.iceTransportPolicy
    });

    recvTransportRef.current.on('connect', ({ dtlsParameters }, callback) => {
      let msg = new ConnectConsumerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      }
      send(msg);
      callback();
    });

  }

  async function onProducerTransportCreated(msgIn: ProducerTransportCreatedMsg) {
    console.log("-- onProducerTransportCreated");

    //the server has created a transport
    //create a client transport to connect to the server transport
    sendTransportRef.current = deviceRef.current.createSendTransport({
      id: msgIn.data!.transportId,
      iceServers: msgIn.data!.iceServers,
      iceCandidates: msgIn.data!.iceCandidates,
      iceParameters: msgIn.data!.iceParameters,
      dtlsParameters: msgIn.data!.dtlsParameters,
      iceTransportPolicy: msgIn.data!.iceTransportPolicy
    });

    sendTransportRef.current.on("connect", ({ dtlsParameters }, callback) => {
      console.log("-- sendTransport connect");
      //fires when the transport connects to the mediasoup server

      let msg = new ConnectProducerTransportMsg();
      msg.data = {
        dtlsParameters: dtlsParameters
      };
      send(msg);

      callback();

    });

    sendTransportRef.current.on('produce', ({ kind, rtpParameters }, callback) => {

      console.log("-- sendTransport produce");

      //fires when we call produce with local tracks
      let msg = new ProduceMsg();
      msg.data = {
        kind: kind,
        rtpParameters: rtpParameters
      }
      send(msg);
      //what is the id value???
      callback({ id: 'placeholder' });
    });

  }

  async function onRoomJoinResult(msgIn: RoomJoinResultMsg) {

    console.log("-- onRoomJoinResult");

    if (msgIn.data!.roomId) {
      setLocalRoomId(msgIn.data!.roomId);
      setRoomConnected(true);
      writeLog("joined room " + msgIn.data!.roomId);
    } else {
      setLocalRoomId("");
      setRoomConnected(false);
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;

    //publish local stream
    await produceLocalStreams();

    console.log("-- onRoomJoinResult peers :" + msgIn.data?.peers.length);

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let peer of msgIn.data.peers) {
        let newpeer = {
          id: peer.peerId,
          name: "",
          hasAudio: false,
          hasVideo: false,
        };

        peers.push(newpeer);

        console.log(peer.peerId);
        console.log("-- onRoomJoinResult producers :" + peer.producers?.length);
        if (peer.producers) {
          for (let producer of peer.producers) {
            console.log("-- onRoomJoinResult producer " + producer.kind, producer.producerId);
            consumeProducer(peer.peerId, producer.producerId);
          }
        }
      }
    }

    setPeers(peers);

  }

  async function onRoomNewPeer(msgIn: RoomNewPeerMsg) {
    console.log("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    writeLog("new PeeerJoined " + msgIn.data?.peerId);

    let newPeer: Peer = {
      id: msgIn.data.peerId,
      name: "",
      hasAudio: false,
      hasVideo: false
    };

    peers.push(newPeer)
    setPeers(peers);

    if (msgIn.data?.producers) {
      for (let producer of msgIn.data.producers) {
        consumeProducer(msgIn.data.peerId, producer.producerId);
      }
    }
  }

  async function onRoomPeerLeft(msgIn: RoomPeerLeftMsg) {
    writeLog("peer left the room:" + msgIn.data?.peerId);

    let idx = peers.findIndex(p => p.id == msgIn.data?.peerId);
    setPeers(peers.splice(idx, 1));

    //destroy the video element
    if (msgIn.data && msgIn.data.peerId) {
      let video = document.getElementById(msgIn.data?.peerId);
      video?.remove();
    }

  }

  async function onRoomNewProducer(msgIn: RoomNewProducerMsg) {
    writeLog("onRoomNewProducer: " + msgIn.data?.kind);
    consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
  }

  async function produceLocalStreams() {
    writeLog("produceLocalStreams");
    //get the tracks and start sending the streams "produce"
    const localStream = localVideoRef.current.srcObject as any;
    for (const track of localStream.getTracks()) {
      console.log("sendTransport produce ");
      await sendTransportRef.current.produce({ track });
    }
  }

  async function consumeProducer(remotePeerId: string, producerId: string) {
    console.log("consumeProducer :" + remotePeerId, producerId);
    if (remotePeerId === localPeerId) {
      console.error("you can't consume yourself.");
    }

    let msg = new ConsumeMsg();
    msg.data = {
      remotePeerId: remotePeerId,
      producerId: producerId,
      rtpCapabilities: deviceRef.current.rtpCapabilities
    }
    send(msg);
  }

  async function onConsumed(msgIn: ConsumedMsg) {

    const consumer = await recvTransportRef.current.consume({
      id: msgIn.data!.consumerId,
      producerId: msgIn.data!.producerId,
      kind: msgIn.data!.kind,
      rtpParameters: msgIn.data!.rtpParameters
    });
    addTrackToRemoteVideo(msgIn.data!.peerId, consumer.kind, consumer.track);
  }

  async function onProduced(msgIn: ProducedMsg) {
    writeLog("onProduced " + msgIn.data?.kind);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">

        <h1 className="text-2xl font-bold">Conference Room</h1>
        {isInRoom() && (
          <div className="flex items-center space-x-2">
            <span className="bg-green-500 h-3 w-3 rounded-full"></span>
            <span>Room: {localRoomId}</span>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {!isInRoom() ? (
          /* Join Room Form */
          <div className="flex flex-col items-center justify-center flex-grow bg-gray-900 p-6">
            <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-xl font-semibold mb-6 text-center">Join a Conference Room</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Room ID</label>
                  <input
                    type="text"
                    value={localRoomId}
                    onChange={(e) => setLocalRoomId(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter room ID"
                  />
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleRoomJoin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
                  >
                    Join Room
                  </button>
                </div>

                <div className="text-sm text-gray-400 mt-4">
                  Your Peer ID: <span className="font-mono">{localPeerId}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Conference Room */
          <>
            {/* Video grid */}
            <div className="flex-grow p-4 flex flex-col">
              {/* View toggle buttons */}
              <div className="flex mb-4 space-x-2">
                <button
                  onClick={() => setActiveView('grid')}
                  className={`px-3 py-1 rounded ${activeView === 'grid' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  <Users size={16} className="inline mr-1" /> Grid View
                </button>
                <button
                  onClick={() => setActiveView('focus')}
                  className={`px-3 py-1 rounded ${activeView === 'focus' ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  Focus View
                </button>
                <button
                  onClick={() => setActiveView('chat')}
                  className={`px-3 py-1 rounded ${activeView === 'chat' ? 'bg-blue-600' : 'bg-gray-700'} md:hidden`}
                >
                  <MessageSquare size={16} className="inline mr-1" /> Chat
                </button>
              </div>

              {/* Video container */}
              <div className="flex-grow">
                {activeView === 'grid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
                    {/* Local video */}
                    <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                      <video
                        ref={localVideoRef}
                        className={`w-full h-full object-cover ${!videoEnabled && 'hidden'}`}
                        autoPlay
                        playsInline
                        muted
                      />
                      {!videoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                          <div className="h-20 w-20 rounded-full bg-gray-600 flex items-center justify-center">
                            <span className="text-2xl font-bold">{displayName.charAt(0)}</span>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-60 px-2 py-1 rounded">
                        {displayName} (You)
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1">
                        {!audioEnabled && (
                          <span className="bg-red-500 p-1 rounded">
                            <MicOff size={16} />
                          </span>
                        )}
                        {!videoEnabled && (
                          <span className="bg-red-500 p-1 rounded">
                            <VideoOff size={16} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remote videos - mapped from peers */}
                    {peers.map(peer => (
                      <div key={peer.id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                        {peer.hasVideo || peer.hasAudio ? (
                          <div className="w-full h-full bg-gray-700">                            
                            <div className="w-full h-full" style={{ background: `hsl(${peer.id.charCodeAt(0) * 10}, 70%, 40%)` }}>
                              
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                            <div className="h-20 w-20 rounded-full bg-gray-600 flex items-center justify-center">
                              <span className="text-2xl font-bold">{peer.name.charAt(0)}</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-60 px-2 py-1 rounded">
                          {peer.name}
                        </div>
                        <div className="absolute top-2 right-2 flex space-x-1">
                          {!peer.hasAudio && (
                            <span className="bg-red-500 p-1 rounded">
                              <MicOff size={16} />
                            </span>
                          )}
                          {!peer.hasVideo && (
                            <span className="bg-red-500 p-1 rounded">
                              <VideoOff size={16} />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeView === 'focus' && (
                  <div className="flex flex-col h-full">
                    {/* Main focused video */}
                    <div className="flex-grow bg-gray-800 rounded-lg mb-4 relative">
                      {/* Mock main focused video - using first peer or local */}
                      <div className="w-full h-full" style={{ background: peers.length > 0 ? `hsl(${peers[0].id.charCodeAt(0) * 10}, 70%, 40%)` : 'black' }}></div>
                      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-60 px-2 py-1 rounded">
                        {peers.length > 0 ? peers[0].name : displayName + ' (You)'}
                      </div>
                    </div>

                    {/* Thumbnails row */}
                    <div className="h-24 flex space-x-2 overflow-x-auto">
                      {/* Local thumbnail */}
                      <div className="h-full w-32 bg-gray-800 rounded flex-shrink-0 relative" onClick={() => { }}>
                        <video
                          ref={localVideoRef}
                          className={`w-full h-full object-cover ${!videoEnabled && 'hidden'}`}
                          autoPlay
                          playsInline
                          muted
                        />
                        {!videoEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                            <span className="text-lg font-bold">{displayName.charAt(0)}</span>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 text-xs bg-gray-900 bg-opacity-60 px-1 rounded">
                          You
                        </div>
                      </div>

                      {/* Remote thumbnails */}
                      {peers.map(peer => (
                        <div key={peer.id} className="h-full w-32 bg-gray-800 rounded flex-shrink-0 relative" onClick={() => { }}>
                          <div className="w-full h-full" style={{ background: `hsl(${peer.id.charCodeAt(0) * 10}, 70%, 40%)` }}></div>
                          <div className="absolute bottom-1 left-1 text-xs bg-gray-900 bg-opacity-60 px-1 rounded">
                            {peer.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeView === 'chat' && (
                  <div className="h-full bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">Chat</h3>
                    <div className="h-full flex flex-col">
                      <div className="flex-grow overflow-y-auto mb-4 bg-gray-700 rounded p-3">
                        <div className="text-gray-400 text-center">Chat messages will appear here</div>
                      </div>
                      <div className="flex">
                        <input
                          type="text"
                          className="flex-grow px-4 py-2 rounded-l bg-gray-700 focus:outline-none"
                          placeholder="Type a message..."
                        />
                        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-r">
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - logs and chat on desktop */}
            <div className={`w-full md:w-80 bg-gray-800 ${activeView === 'chat' ? 'block' : 'hidden md:block'}`}>
              <div className="h-full flex flex-col">
                {/* Tabs for desktop */}
                <div className="border-b border-gray-700 hidden md:flex">
                  <button className="px-4 py-2 border-b-2 border-blue-500 font-medium">
                    Logs
                  </button>
                  <button className="px-4 py-2 text-gray-400 hover:text-white">
                    Chat
                  </button>
                </div>

                {/* Logs panel */}
                <div className="flex-grow p-4 overflow-auto">
                  <h3 className="text-lg font-semibold mb-2">System Logs</h3>
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div key={index} className="text-sm text-gray-300 border-l-2 border-gray-600 pl-2">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer controls */}
      {isInRoom() && (
        <footer className="bg-gray-800 p-4 shadow-inner">
          <div className="flex justify-center space-x-4">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button
              onClick={handleRoomLeave}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700"
              title="Leave Room"
            >
              <LogOut size={24} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default ConferenceRoom;