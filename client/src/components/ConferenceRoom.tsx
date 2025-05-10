import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, LogOut, Users, MessageSquare } from 'lucide-react';
import * as mediasoupClient from 'mediasoup-client';
import { ConnectConsumerTransportMsg, ConnectProducerTransportMsg, ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, CreateConsumerTransportMsg, CreateProducerTransportMsg, payloadTypeServer, ProducedMsg, ProduceMsg, ProducerTransportCreatedMsg, RegisterMsg, RegisterResultMsg, RoomJoinMsg, RoomJoinResultMsg, RoomLeaveMsg, RoomNewPeerMsg, RoomNewProducerMsg, RoomPeerLeftMsg } from './payload';

interface Peer {
  peerId: string;
  displayName: string;
  hasVideo: boolean;
  hasAudio: boolean;
  videoEle: HTMLVideoElement;
}

interface StreamInfo {
  peerId: string,
  stream : MediaStream
}

const ConferenceRoom: React.FC = () => {
  const [localRoomId, setLocalRoomId] = useState<string>("");
  const [roomConnected, setRoomConnected] = useState<boolean>(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [localPeer, setLocalPeer] = useState<Peer>({ peerId: "", displayName: "", hasAudio: false, hasVideo: false, videoEle: null });
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<"grid" | "focus" | "chat">("grid");

  const localVideoContainer = useRef<HTMLDivElement | null>(null);
  const remoteVideoContainers = useRef<{}>({});
  //const remoteVideoElements = useRef<{}>({});
  const [remoteStreams, setRemoteStreams] = useState<StreamInfo[]>([]);

  // onst localVideoRef = useRef<HTMLVideoElement>(null);
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

  // useEffect(() => {
  //   console.log("Peers updated:", peers);
  //   // Optional: Re-sync video elements or producers if needed
  //   peers.forEach((peer) => {
  //     if (!remoteVideoContainers.current[peer.peerId] && peer.videoEle) {
  //       console.log(`Restoring video for peer ${peer.peerId}`);
  //       const div = document.createElement("div");
  //       div.className = "w-full h-full bg-gray-700";
  //       div.appendChild(peer.videoEle);
  //       remoteVideoContainers.current[peer.peerId] = div;
  //     }
  //   });
  // }, [peers]);


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

  const send = async (msg: any) => {
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

  const addPeer = (newPeer: Peer) => {
    setPeers((prevPeers) => {
      // Prevent duplicates by checking peerId
      if (prevPeers.some((p) => p.peerId === newPeer.peerId)) {
        console.log(`Peer ${newPeer.peerId} already exists, skipping add`);
        return prevPeers;
      }
      console.log(`Adding peer ${newPeer.peerId}`);
      return [...prevPeers, newPeer];
    });
  };

  const removePeer = (peerId: string) => {
    setPeers((prevPeers) => {
      const updatedPeers = prevPeers.filter((p) => p.peerId !== peerId);
      console.log(`Removing peer ${peerId}, new peers count: ${updatedPeers.length}`);
      return updatedPeers;
    });

    // Clean up video element
    const video = document.getElementById(peerId) as HTMLVideoElement | null;
    if (video) {
      video.srcObject = null; // Clear MediaStream
      video.remove();
      console.log(`Removed video element for peer ${peerId}`);
    }

    // Clean up ref
    if (remoteVideoContainers.current[peerId]) {
      delete remoteVideoContainers.current[peerId];
    }    
  };


  const addRemoteStream = (peerId: string, track: MediaStreamTrack) => {
    setRemoteStreams((prev) => {
      const existing = prev.find(s => s.peerId === peerId);
  
      if (!existing) {
        // No stream yet, create new one
        const newStreamInfo: StreamInfo = {
          peerId,
          stream: new MediaStream([track])
        };
        return [...prev, newStreamInfo];
      } else {
        // Clone the stream and add track immutably
        const newStream = new MediaStream(existing.stream.getTracks());
        newStream.addTrack(track);
  
        const updated = prev.map(s =>
          s.peerId === peerId ? { peerId, stream: newStream } : s
        );
  
        return updated;
      }
    });
  };
  
  const removeRemoteStream = (peerId: string) => {
    setRemoteStreams((prev) => {
      const streamInfo = prev.find((stream) => stream.peerId === peerId);
      if (streamInfo) {
        // Stop all tracks to free resources
        streamInfo.stream.getTracks().forEach((track) => track.stop());
        console.log(`Removed stream for peer ${peerId}`);
      }
      const updatedStreams = prev.filter((stream) => stream.peerId !== peerId);
      return updatedStreams;
    });
  
    // Clean up video element and container
    const video = document.getElementById(peerId) as HTMLVideoElement | null;
    if (video) {
      video.srcObject = null;
      video.remove();
    }
    if (remoteVideoContainers.current[peerId]) {
      delete remoteVideoContainers.current[peerId];
    }
  };



  const register = async () => {
    console.log("-- register");

    let msg = new RegisterMsg();
    msg.authToken = ""; //need authtoken from server
    msg.displayName = localPeer.displayName;
    send(msg);
  }

  const handleRoomJoin = async () => {
    roomJoin(localRoomId);
  }

  const handleRoomLeave = async () => {
    roomLeave();
  }

  const onRegisterResult = async (msgIn: RegisterResultMsg) => {

    writeLog("-- onRegisterResult");

    localPeer.peerId = msgIn.data!.peerid;
    setLocalPeer(localPeer);

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

  const addTrackToRemoteVideo = async (peerId: string, kind: string, track: MediaStreamTrack) => {

    addRemoteStream(peerId, track);    

    // const peer = peers.find((p) => p.peerId === peerId);
    // if (!peer) {
    //   console.error(`Peer ${peerId} not found in addTrackToRemoteVideo`);
    //   writeLog(`Error: Peer ${peerId} not found for track ${kind}`);
    //   return;
    // }

    // console.log(`Adding ${kind} track for peer ${peerId}`);

    // if (kind === "video") {
    //   peer.hasVideo = true;
    // } else if (kind === "audio") { // Fixed typo: "audioo" → "audio"
    //   peer.hasAudio = true;
    // }

    // let video = document.getElementById(peerId) as HTMLVideoElement | null;

    // if (!video) {
    //   video = document.createElement("video");
    //   video.id = peerId;
    //   video.autoplay = true;
    //   video.playsInline = true;
    //   video.className = "w-full h-full object-cover";
    //   video.srcObject = new MediaStream([track]);
    //   //peer.videoEle = video;
    // }

    // let mediaStream = video.srcObject as MediaStream;
    // if (!mediaStream) {
    //   mediaStream = new MediaStream();
    //   video.srcObject = mediaStream;
    // }

    // mediaStream.addTrack(track);

    // video.play().catch((error) => {
    //   console.error(`Error playing video for peer ${peerId}:`, error);
    // });

    // if (remoteVideoContainers.current[peerId]) {
    //   const div = remoteVideoContainers.current[peerId] as HTMLDivElement;
    //   if (!div.contains(video)) {
    //     div.appendChild(video);
    //   }
    // } else {
    //   console.warn(`No video container for peer ${peerId}`);
    // }

    // Update peer in state to reflect changes
    // setPeers((prev) =>
    //   prev.map((p) => (p.peerId === peerId ? { ...p, hasVideo: peer.hasVideo, hasAudio: peer.hasAudio, videoEle: peer.videoEle } : p))
    // );

    //remoteVideoElements.current[peerId] = video;


  };

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

    let video = document.createElement("video");
    video.id = "localvideo";
    video.autoplay = true;
    video.playsInline = true;
    video.className = "w-full h-full object-cover";
    video.srcObject = stream;

    localVideoContainer.current.appendChild(video);
    localPeer.videoEle = video;

    setLocalPeer((prev) => ({ ...prev, videoEle: video }));

    //publish local stream
    await produceLocalStreams();

    console.log("-- onRoomJoinResult peers :" + msgIn.data?.peers.length);

    //connect to existing peers  
    if (msgIn.data && msgIn.data.peers) {
      for (let peer of msgIn.data.peers) {
        let newpeer: Peer = {
          peerId: peer.peerId,
          displayName: "",
          hasAudio: false,
          hasVideo: false,
          videoEle: null
        };

        addPeer(newpeer);

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



  }

  async function onRoomNewPeer(msgIn: RoomNewPeerMsg) {
    console.log("onRoomNewPeer " + msgIn.data?.peerId + " producers: " + msgIn.data?.producers?.length);
    writeLog("new PeeerJoined " + msgIn.data?.peerId);

    let newPeer: Peer = {
      peerId: msgIn.data.peerId,
      displayName: "",
      hasAudio: false,
      hasVideo: false,
      videoEle: null
    };

    addPeer(newPeer);

    console.log(peers);

    if (msgIn.data?.producers) {
      for (let producer of msgIn.data.producers) {
        consumeProducer(msgIn.data.peerId, producer.producerId);
      }
    }
  }

  async function onRoomPeerLeft(msgIn: RoomPeerLeftMsg) {
    writeLog("peer left the room, peerid:" + msgIn.data?.peerId);

    removePeer(msgIn.data.peerId);
    removeRemoteStream(msgIn.data.peerId);

  }

  async function onRoomNewProducer(msgIn: RoomNewProducerMsg) {
    writeLog("onRoomNewProducer: " + msgIn.data?.kind);
    consumeProducer(msgIn.data?.peerId!, msgIn.data?.producerId!);
  }

  async function produceLocalStreams() {
    writeLog("produceLocalStreams");
    //get the tracks and start sending the streams "produce"
    const localStream = localPeer.videoEle.srcObject as any;
    for (const track of localStream.getTracks()) {
      console.log("sendTransport produce ");
      await sendTransportRef.current.produce({ track });
    }
  }

  async function consumeProducer(remotePeerId: string, producerId: string) {
    console.log("consumeProducer :" + remotePeerId, producerId);
    if (remotePeerId === localPeer.peerId) {
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
                    value={localPeer.displayName}
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
                  Your Peer ID: <span className="font-mono">{localPeer.peerId}</span>
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
                    <div ref={localVideoContainer} className="relative bg-gray-800 rounded-lg overflow-hidden">
                      <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-60 px-2 py-1 rounded">
                        {localPeer.displayName}
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

                    {remoteStreams.map((streamInfo) => {
                      console.log(`Rendering stream for peer ${streamInfo.peerId}`);
                      return (
                        <div key={streamInfo.peerId} className="relative bg-gray-800 rounded-lg overflow-hidden">
                          <video
                            ref={el => {
                              if (el) {
                                console.log("set srcObject", streamInfo.peerId)
                                el.srcObject = streamInfo.stream;
                              }
                            }}
                            autoPlay
                            playsInline
                            muted={false}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-60 px-2 py-1 rounded">
                            name
                          </div>
                          <div className="absolute top-2 right-2 flex space-x-1">
                            <span className="bg-red-500 p-1 rounded">
                              <MicOff size={16} />
                            </span>

                            <span className="bg-red-500 p-1 rounded">
                              <VideoOff size={16} />
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                )}

                {activeView === 'focus' && (
                  <div className="flex flex-col h-full">
                    {/* Main focused video */}
                    <div className="flex-grow bg-gray-800 rounded-lg mb-4 relative">
                      {/* Mock main focused video - using first peer or local */}
                      <div className="w-full h-full" style={{ background: peers.length > 0 ? `hsl(${peers[0].peerId.charCodeAt(0) * 10}, 70%, 40%)` : 'black' }}></div>
                      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-60 px-2 py-1 rounded">
                        {peers.length > 0 ? peers[0].displayName : localPeer.displayName + ' (You)'}
                      </div>
                    </div>

                    {/* Thumbnails row */}
                    <div className="h-24 flex space-x-2 overflow-x-auto">
                      {/* Local thumbnail */}
                      <div className="h-full w-32 bg-gray-800 rounded flex-shrink-0 relative" onClick={() => { }}>

                        {!videoEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                            <span className="text-lg font-bold">{localPeer.displayName.charAt(0)}</span>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 text-xs bg-gray-900 bg-opacity-60 px-1 rounded">
                          You
                        </div>
                      </div>

                      {/* Remote thumbnails */}
                      <div className="h-full w-32 bg-gray-800 rounded flex-shrink-0 relative" onClick={() => { }}>
                        <div className="absolute bottom-1 left-1 text-xs bg-gray-900 bg-opacity-60 px-1 rounded">
                        </div>
                      </div>
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