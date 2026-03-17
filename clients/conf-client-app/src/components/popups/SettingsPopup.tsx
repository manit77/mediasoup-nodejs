import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Form, Tab, Row, Col, Nav } from 'react-bootstrap';
import {
    Mic, CameraVideo, PersonVideo,
    GearFill, Cpu, CheckCircleFill,
    ExclamationCircle, FilePersonFill,
    InfoCircle, SpeakerFill
} from 'react-bootstrap-icons';
import { useUI } from '@client/contexts/UIContext';
import '@client/css/modal.css';
import '@client/css/buttons.css';
import { useDevice } from '@client/contexts/DeviceContext';


const SettingsPopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {   
    const { availableDevices, getMediaConstraints, selectedDevices, setSelectedDevices } = useDevice();
    const ui = useUI();
    const [audioId, setAudioId] = useState("");
    const [videoId, setVideoId] = useState("");
    const [speakerId, setSpeakerId] = useState("");
    const [showingPreview, setShowingPreview] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0); // 🔊 audio meter state
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationRef = useRef<number | null>(null);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return () => {
            stopPreview();
        };
    }, []);

    useEffect(() => {
        if (!show) {
            stopPreview();
            return;
        }
    }, [show]);

    // When modal opens or selectedDevices change while open, sync dropdowns to context
    useEffect(() => {
        if (show) {
            setAudioId(selectedDevices.audioInId ?? '');
            setVideoId(selectedDevices.videoId ?? '');
            setSpeakerId(selectedDevices.audioOutId ?? '');
        }
    }, [show, selectedDevices.audioInId, selectedDevices.videoId, selectedDevices.audioOutId]);

    const handleDeviceChange = (type: 'video' | 'audioIn' | 'audioOut', deviceId: string, deviceName: string) => {
        if (type === 'video') {
            setVideoId(deviceId);
            setSelectedDevices(prev => ({ ...prev, videoId: deviceId, videoLabel: deviceName }));
        } else if (type === 'audioIn') {
            setAudioId(deviceId);
            setSelectedDevices(prev => ({ ...prev, audioInId: deviceId, audioInLabel: deviceName }));
        } else {
            setSpeakerId(deviceId);
            setSelectedDevices(prev => ({ ...prev, audioOutId: deviceId, audioOutLabel: deviceName }));
        }
        if (showingPreview) {
            startPreview();
        }
    };

    const closeButtonClick = () => {
        handleClose();
    };

    const previewClick = () => {
        if (showingPreview) {
            stopPreview();
            return;
        } else {
            startPreview();
        }
        setShowingPreview(prev => !prev);
    };

    const startPreview = async () => {

        try {

            const constraints = getMediaConstraints(true, true);
            let stream: MediaStream

            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (!stream) {
                    ui.showPopUp("Unable to access media devices. Please check permissions and try again.", 'error', 30);
                    return;
                }
                streamRef.current = stream;
            } catch (err) {
                console.error("Error accessing media devices:", err);
                ui.showPopUp("Error accessing media devices.", 'error', 30);
                return;
            }           

            setAudioId(selectedDevices.audioInId ?? '');
            setVideoId(selectedDevices.videoId ?? '');
            startAudioMeter(stream);
            startVideoPreview(stream);
            setShowingPreview(true);

        } catch (err) {
            console.error("Permission or device error:", err);
            ui.showPopUp(err.message, 'error', 30);
        }
    };

    const stopPreview = () => {
        stopAudioMeter();
        stopVideoPreview();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setShowingPreview(false);
    };

    const startAudioMeter = async (stream: MediaStream) => {
        try {
            stopAudioMeter();

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioContext;

            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }
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
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
        animationRef.current = null;
        if (analyserRef.current) {
            analyserRef.current.disconnect();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        analyserRef.current = null;
        audioContextRef.current = null;
        setAudioLevel(0);
    };

    const startVideoPreview = (stream: MediaStream) => {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
            ui.showPopUp("No video devices available", "error");
            stream.getTracks().forEach((track) => track.stop());
            setShowingPreview(false);
            return;
        }
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => {
            console.error("Video preview failed to play:", e);
        });
    };

    const stopVideoPreview = () => {
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered scrollable dialogClassName="settings-popup-modal" className="priority-modal-layer" backdropClassName="priority-modal-backdrop">
            <Modal.Header closeButton className="bg-body">
                <Modal.Title className="d-flex align-items-center text-secondary">
                    <GearFill className="me-2 text-primary" size={20} />
                    <span>Settings</span>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-0">
                <Tab.Container id="settings-tabs" defaultActiveKey="devices">
                    <Row className="g-0">
                        {/* Sidebar Navigation */}
                        <Col sm={4} className="bg-body border-end p-3">
                            <Nav variant="pills" className="flex-column gap-2">
                                <Nav.Item>
                                    <Nav.Link eventKey="devices" className="d-flex align-items-center px-3 py-2">
                                        <Cpu className="me-2" /> Media Devices
                                    </Nav.Link>
                                </Nav.Item>
                                {/* Future expansion tabs could go here */}
                            </Nav>
                            <div className="mt-auto pt-5 text-center text-muted small px-3">
                                <InfoCircle className="me-1" />
                                Settings are applied to your current session.
                            </div>
                        </Col>

                        {/* Content Area */}
                        <Col sm={8} className="p-4">
                            <Tab.Content>
                                <Tab.Pane eventKey="devices">
                                    {/* Audio Section */}
                                    <div className="mb-4">
                                        <h6 className="text-uppercase text-muted fw-bold small mb-3">
                                            <Mic className="me-2" /> Audio Input
                                        </h6>
                                        {availableDevices.audioIn.length > 0 ? (
                                            <Form.Select
                                                id="ctlMic"
                                                value={audioId || ""}
                                                onChange={(e) => handleDeviceChange('audioIn', e.target.value, e.target.selectedOptions[0].text)}
                                                className="mb-3 shadow-sm border-primary-subtle"
                                            >
                                                {availableDevices.audioIn.map(device => (
                                                    <option key={device.id} value={device.id}>{device.label}</option>
                                                ))}
                                            </Form.Select>
                                        ) : (
                                            <div className="alert alert-warning py-2 small">
                                                <ExclamationCircle className="me-2" /> No microphones detected.
                                            </div>
                                        )}

                                        {/* Modernized Audio Meter */}
                                        <div className="d-flex align-items-center bg-body p-2 rounded border" style={{ gap: '12px' }}>
                                            <div className="audio-meter flex-grow-1" style={{
                                                height: "8px",
                                                background: "#e9ecef",
                                                borderRadius: "10px",
                                                overflow: "hidden"
                                            }}>
                                                <div
                                                    ref={barRef}
                                                    style={{
                                                        width: `${audioLevel * 100}%`,
                                                        height: "100%",
                                                        background: audioLevel > 0.8 ? "#dc3545" : "#0d6efd", // Turns red if peaking
                                                        transition: "width 50ms ease-out",
                                                        boxShadow: "0 0 8px rgba(13, 110, 253, 0.5)"
                                                    }}
                                                />
                                            </div>
                                            <div className="small fw-bold text-primary" style={{ minWidth: "35px" }}>
                                                {Math.round(audioLevel * 100)}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Audio Output (Speaker) */}
                                    {availableDevices.audioOut.length > 0 && (
                                        <>
                                            <hr className="my-4" />
                                            <div className="mb-4">
                                                <h6 className="text-uppercase text-muted fw-bold small mb-3">
                                                    <SpeakerFill className="me-2" /> Audio Output
                                                </h6>
                                                <Form.Select
                                                    id="ctlSpeaker"
                                                    value={speakerId || ''}
                                                    onChange={(e) => handleDeviceChange('audioOut', e.target.value, e.target.selectedOptions[0].text)}
                                                    className="shadow-sm border-primary-subtle"
                                                >
                                                    {availableDevices.audioOut.map(device => (
                                                        <option key={device.id} value={device.id}>{device.label}</option>
                                                    ))}
                                                </Form.Select>
                                            </div>
                                        </>
                                    )}

                                    <hr className="my-4" />

                                    {/* Video Section */}
                                    <div className="mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h6 className="text-uppercase text-muted fw-bold small mb-0">
                                                <CameraVideo className="me-2" /> Video Input
                                            </h6>
                                            {showingPreview && (
                                                <span className="badge rounded-pill bg-danger d-flex align-items-center">
                                                    <span className="me-1" style={{ height: '6px', width: '6px', backgroundColor: 'white', borderRadius: '50%', display: 'inline-block' }}></span>
                                                    LIVE PREVIEW
                                                </span>
                                            )}
                                        </div>

                                        {availableDevices.video.length > 0 ? (
                                            <Form.Select
                                                id="ctlCam"
                                                value={videoId || ""}
                                                onChange={(e) => handleDeviceChange('video', e.target.value, e.target.selectedOptions[0].text)}
                                                className="mb-3 shadow-sm border-primary-subtle"
                                            >
                                                {availableDevices.video.map(device => (
                                                    <option key={device.id} value={device.id}>{device.label}</option>
                                                ))}
                                            </Form.Select>
                                        ) : (
                                            <div className="alert alert-warning py-2 small">
                                                <ExclamationCircle className="me-2" /> No cameras detected.
                                            </div>
                                        )}

                                        {/* Video Preview Area */}
                                        <div className="position-relative bg-dark rounded overflow-hidden shadow" style={{ maxHeight: "200px" }}>
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-100 h-auto d-block"
                                                style={{ transform: 'scaleX(-1)', maxHeight: "200px" }} // Mirror the preview for better user feel
                                            />

                                            {!showingPreview && (
                                                <div className="position-absolute top-50 start-50 translate-middle text-center text-white-50 w-100">
                                                    <PersonVideo size={48} className="mb-2 opacity-25 mx-auto" />
                                                    <p className="small m-0">Camera preview is off</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 text-end">
                                            <Button
                                                variant={showingPreview ? "outline-danger" : "outline-primary"}
                                                size="sm"
                                                onClick={previewClick}
                                                className="submit-btn"
                                            >
                                                <FilePersonFill className="me-1" />
                                                {showingPreview ? 'Stop Preview' : 'Test Devices'}
                                            </Button>
                                        </div>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Col>
                    </Row>
                </Tab.Container>
            </Modal.Body>

            <Modal.Footer className="bg-body border-top p-3">
                <Button variant="primary" onClick={closeButtonClick} className="submit-btn px-5 shadow-sm">
                    <CheckCircleFill className="me-2" /> Apply Changes
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SettingsPopup;
