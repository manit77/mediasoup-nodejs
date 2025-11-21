import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Form, Tab, Row, Col, Nav } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { FilePersonFill } from 'react-bootstrap-icons';
import { useUI } from '../../hooks/useUI';
import { getBrowserUserMedia } from '@conf/conf-client';

const SettingsPopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const {
        availableDevices,
        selectedDevices,
        setSelectedDevices,
        getMediaDevices,
        getMediaConstraints,
    } = useCall();
    const ui = useUI();

    const [audioId, setAudioId] = useState("");
    const [videoId, setVideoId] = useState("");
    //const [speakerId, setSpeakerId] = useState("");
    const [showingPreview, setShowingPreview] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0); // 🔊 audio meter state
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return () => {
            stopAudioMeter();
            if (videoRef.current) {
                let stream = videoRef.current.srcObject as MediaStream;
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }
            }
            setShowingPreview(false);
        };
    }, []);

    useEffect(() => {
        const initMedia = async () => {
            if (!show) {
                stopAudioMeter();
                if (videoRef.current) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    if (stream) {
                        stream.getTracks().forEach(t => t.stop());
                    }
                }
                setShowingPreview(false);
                return;
            }

            try {
                // Request full mic+camera permission first
                const tempStream = await getBrowserUserMedia({ audio: true, video: true });
                tempStream.getTracks().forEach(track => track.stop());
                
                await getMediaDevices();
                setAudioId(selectedDevices.audioInId);
                setVideoId(selectedDevices.videoId);
                
                startAudioMeter(selectedDevices.audioInId);
            } catch (err) {
                console.error("Permission or device error:", err);
                ui.showPopUp("Please grant camera and microphone permissions to access devices.", 'error', 30);
            }
        };

        initMedia();
    }, [show, selectedDevices]);

    const handleDeviceChange = (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
        if (type === "video") {
            setVideoId(deviceId);
            selectedDevices.videoId = deviceId;
        } else if (type === "audioIn") {
            setAudioId(deviceId);
            selectedDevices.audioInId = deviceId;
            stopAudioMeter();
            startAudioMeter(deviceId); // restart meter with new mic
        } else {
            //setSpeakerId(deviceId);
            selectedDevices.audioOutId = deviceId;
        }
    };

    const closeButtonClick = async () => {
        setSelectedDevices(prev => ({ ...selectedDevices }));
        handleClose();
    };

    const previewClick = () => {
        setShowingPreview(prev => !prev);
    };

    const startAudioMeter = async (deviceId?: string) => {
        try {
            stopAudioMeter();

            const stream = await getBrowserUserMedia({
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                video: false
            });

            audioStreamRef.current = stream;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            source.connect(analyser);

            let frameCount = 0;

            const update = () => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const level = avg / 255;

                // Smooth instant visual update without React delay
                if (barRef.current) {
                    barRef.current.style.width = `${Math.min(level * 100, 100)}%`;
                    barRef.current.style.background =
                        level > 0.6 ? "#dc3545" :
                            level > 0.3 ? "#ffc107" :
                                "#28a745";
                }

                // Update React state less frequently (every ~6 frames)
                if (++frameCount % 6 === 0) {
                    setAudioLevel(level);
                }

                animationRef.current = requestAnimationFrame(update);
            };
            update();

        } catch (err) {
            console.error("Error accessing microphone:", err);
            setAudioLevel(0);
        }
    };

    const stopAudioMeter = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        if (analyserRef.current) analyserRef.current.disconnect();
        if (audioContextRef.current) audioContextRef.current.close();
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
        }
        analyserRef.current = null;
        audioContextRef.current = null;
        audioStreamRef.current = null;
        setAudioLevel(0);
    };

    useEffect(() => {
        if (!showingPreview) {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            return;
        }

        const constraints = getMediaConstraints(false, true);
        getBrowserUserMedia(constraints)
            .then((stream) => {
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) audioTrack.enabled = false;
                const videoTrack = stream.getVideoTracks()[0];
                if (!videoTrack) {
                    ui.showPopUp("No video devices available", "error");
                    stream.getTracks().forEach((track) => track.stop());
                    setShowingPreview(false);
                    return;
                }
                videoRef.current.srcObject = new MediaStream([videoTrack]);
            })
            .catch((error) => {
                console.error('Error getting preview stream:', error);
                ui.showPopUp("Failed to get camera. Check permissions.", "error");
                setShowingPreview(false);
            });
    }, [showingPreview]);

    return (
        <Modal show={show} onHide={handleClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Settings</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Tab.Container id="settings-tabs" defaultActiveKey="devices">
                    <Row>
                        <Col sm={3}>
                            <Nav variant="pills" className="flex-column">
                                <Nav.Item>
                                    <Nav.Link eventKey="devices">Media Devices</Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </Col>
                        <Col sm={9}>
                            <Tab.Content>
                                <Tab.Pane eventKey="devices">
                                    <h5>Audio</h5>
                                    {availableDevices.audioIn.length > 0 ? (
                                        <Form.Select
                                            id="ctlMic"
                                            title='Select Microphone'
                                            aria-label="Select Microphone"
                                            value={audioId || ""}
                                            onChange={(e) => handleDeviceChange('audioIn', e.target.value)}
                                            className="mb-3"
                                        >
                                            {availableDevices.audioIn.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No microphones found.</p>}

                                    <div className="d-flex align-items-center mb-3" style={{ gap: '10px' }}>
                                        <div className="audio-meter flex-grow-1" style={{
                                            height: "10px",
                                            background: "#ddd",
                                            borderRadius: "4px",
                                            overflow: "hidden",
                                            position: "relative"
                                        }}>
                                            <div
                                                ref={barRef}
                                                style={{
                                                    width: `0%`,
                                                    height: "100%",
                                                    background: "#28a745",
                                                    transition: "width 50ms linear"
                                                }}
                                            />
                                        </div>

                                        <div style={{
                                            minWidth: "40px",
                                            textAlign: "right",
                                            fontFamily: "monospace",
                                            fontSize: "0.9rem"
                                        }}>
                                            {Math.round(audioLevel * 100)}%
                                        </div>
                                    </div>


                                    <h5>Video</h5>
                                    {availableDevices.video.length > 0 ? (
                                        <Form.Select
                                            id="ctlCam"
                                            title="Select Camera"
                                            aria-label="Select Camera"
                                            value={videoId || ""}
                                            onChange={(e) => handleDeviceChange('video', e.target.value)}
                                            className="mb-3"
                                        >
                                            {availableDevices.video.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No cameras found.</p>}

                                    <h5>Preview</h5>
                                    <div className="d-flex gap-2 mb-3">
                                        <Button
                                            variant="outline-secondary"
                                            onClick={previewClick}
                                            className="d-flex align-items-center"
                                        >
                                            <FilePersonFill className="me-1" /> {showingPreview ? 'Stop Preview' : 'Preview Video'}
                                        </Button>
                                    </div>

                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-100 h-auto rounded shadow-sm"
                                        style={{ background: "#000000" }}
                                    />
                                </Tab.Pane>
                            </Tab.Content>
                        </Col>
                    </Row>
                </Tab.Container>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={closeButtonClick}>
                    Apply
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SettingsPopup;
