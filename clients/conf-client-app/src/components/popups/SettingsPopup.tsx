import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Form, Tab, Row, Col, Nav } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall'; // Assuming settings are also relevant during a call
import { FilePersonFill, Gear } from 'react-bootstrap-icons';
import { useUI } from '../../hooks/useUI';

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
    const [speakerId, setSpeakerId] = useState("");
    const [showingPreview, setShowingPreview] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {

        let video = videoRef.current;
        return () => {
            if (video) {
                let stream: MediaStream = video.srcObject as MediaStream;
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }
            }
        };

    }, []);

    useEffect(() => {
        if (show) {
            getMediaDevices();
            setAudioId(selectedDevices.audioInId);
            setVideoId(selectedDevices.videoId);
            setSpeakerId(selectedDevices.audioOutId);
        }
    }, [selectedDevices, show, getMediaDevices]);

    const handleDeviceChange = (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
        if (type === "video") {
            setVideoId(deviceId);
            selectedDevices.videoId = deviceId;
        } else if (type === "audioIn") {
            setAudioId(deviceId);
            selectedDevices.audioInId = deviceId;
        } else {
            setSpeakerId(deviceId);
            selectedDevices.audioOutId = deviceId;
        }
    };

    const closeButtonClick = async () => {
        setSelectedDevices(prev => ({ ...selectedDevices }));
        handleClose();
    };

    const previewClick = () => {
        setShowingPreview((prev) => !prev); // Just toggle, let effect handle fetch/stop
    };

    useEffect(() => {
        if (!showingPreview) {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            return;
        }

        const constraints = getMediaConstraints(false, true);
        console.log('Fetching preview with constraints:', constraints); // Debug log

        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {

                console.warn('got stream', stream.getTracks());
                videoRef.current.srcObject = stream;
                console.warn(`videoRefSet`);

                // Mute audio
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = false;
                }
                // Ensure video
                const videoTrack = stream.getVideoTracks()[0];
                if (!videoTrack) {
                    ui.showPopUp("No video devices available", "error");
                    stream.getTracks().forEach((track) => track.stop()); // Clean up failed stream
                    setShowingPreview(false);
                    return;
                }
            })
            .catch((error) => {
                console.error('Error getting preview stream:', error);
                ui.showPopUp("Failed to get camera. Check permissions.", "error");
                setShowingPreview(false);
            });


    }, [showingPreview, selectedDevices, getMediaConstraints, ui]);

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
                                {/* <Nav.Item>
                                    <Nav.Link eventKey="screenShare">Screen Share</Nav.Link>
                                </Nav.Item> */}
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
                                            value={audioId || ''}
                                            onChange={(e) => handleDeviceChange('audioIn', e.target.value)}
                                            className="mb-3"
                                        >
                                            {availableDevices.audioIn.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No microphones found.</p>}

                                    {/* <Form.Check label="Mic enabled" checked={isAudioEnabled} onChange={(e) => setIsAudioEnabled(e.target.checked)}></Form.Check> */}


                                    <h5>Video</h5>
                                    {availableDevices.video.length > 0 ? (
                                        <Form.Select
                                            id="ctlCam"
                                            title="Select Camera"
                                            aria-label="Select Camera"
                                            value={videoId || ''}
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
                                        style={{ background: "#c0c0c0c" }}
                                    />

                                    {/* <Form.Check label="Camera enabled" checked={isVideoEnabled} onChange={(e) => setIsVideoEnabled(e.target.checked)}></Form.Check> */}


                                    {/* <h5>Speaker</h5>
                                    {availableDevices.audioOut.length > 0 ? (
                                        <Form.Select
                                        title-"Select Speaker"    
                                        aria-label="Select Speaker"
                                            value={speakerId || ''}
                                            onChange={(e) => handleDeviceChange('audioOut', e.target.value)}
                                            className="mb-3"
                                        >
                                            <option value="">Default Speaker</option>
                                            {availableDevices.audioOut.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No speakers found. (Note: Speaker selection support varies by browser)</p>}
                                     */}

                                </Tab.Pane>
                                {/* <Tab.Pane eventKey="screenShare">
                                    <h5>Select Screen to Share</h5>
                                    <p>When you click "Start Screen Sharing", your browser will prompt you to choose which screen, window, or tab to share.</p>
                                    <Button variant="primary" onClick={handleScreenShareSelect}>
                                        Start Screen Sharing
                                    </Button>
                                </Tab.Pane> */}
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