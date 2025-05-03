import * as mediasoupClient from 'mediasoup-client';

const ws = new WebSocket(`wss://${location.host}`);
const video = document.getElementById('video');
const ctlpeerid = document.getElementById('ctlpeerid');
const container = document.body;

const send = (action, data = {}) => {
    console.log("ws_send ", action, data);    
    ws.send(JSON.stringify({ action, data }))
};


let device;
let sendTransport, recvTransport;
let peerId = "";

const createVideoElement = () => {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.style.width = '300px';
    container.appendChild(v);
    return v;
};

ws.addEventListener('open', async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    video.srcObject = stream;

    send('getRtpCapabilities');
});

ws.addEventListener('message', async (event) => {
    const { action, data } = JSON.parse(event.data);

    console.log("ws_receive ", JSON.parse(event.data));

    switch (action) {
        case "register_result" : {
            peerId = data;
            ctlpeerid.innerText = peerId;
        }
        case 'rtpCapabilities':
            device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: data });
            send('createTransport');
            send('createConsumerTransport');
            break;

        case 'transportCreated':
            sendTransport = device.createSendTransport(data);

            sendTransport.on('connect', ({ dtlsParameters }, callback) => {
                send('connectTransport', dtlsParameters);
                callback();
            });

            sendTransport.on('produce', ({ kind, rtpParameters }, callback) => {
                send('produce', { kind, rtpParameters });
                callback({ id: 'placeholder' });
            });

            const localStream = video.srcObject;
            for (const track of localStream.getTracks()) {
                await sendTransport.produce({ track });
            }
            break;

        case 'consumerTransportCreated':
            recvTransport = device.createRecvTransport(data);

            recvTransport.on('connect', ({ dtlsParameters }, callback) => {
                send('connectConsumerTransport', dtlsParameters);
                callback();
            });
            break;

        case 'newProducer':
            // Automatically request to consume
            send('consume', {
                producerId: data.id,
                rtpCapabilities: device.rtpCapabilities
            });
            break;
        case 'existingProducers':
            for (const producer of data) {
                send('consume', {
                    producerId: producer.id,
                    rtpCapabilities: device.rtpCapabilities
                });
            }
            break;
        case 'consumed':
            const consumer = await recvTransport.consume({
                id: data.id,
                producerId: data.producerId,
                kind: data.kind,
                rtpParameters: data.rtpParameters
            });

            const remoteStream = new MediaStream([consumer.track]);
            const remoteVideo = createVideoElement();
            remoteVideo.srcObject = remoteStream;
            break;
    }
});
