import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Tab, Row, Col, Nav } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall'; // Assuming settings are also relevant during a call

const SettingsPopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const {
        availableDevices,
        selectedDevices,
        getMediaDevices,
        switchDevices,
    } = useCall();

    const [audioId, setAudioId] = useState("");
    const [videoId, setVideoId] = useState("");
    const [speakerId, setSpeakerId] = useState("");
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);

    useEffect(() => {
        if (show) {
            getMediaDevices();
            setAudioId(selectedDevices.audioInId);
            setVideoId(selectedDevices.videoId);
            setSpeakerId(selectedDevices.audioOutId);
            setIsVideoEnabled(selectedDevices.isVideoEnabled);
            setIsAudioEnabled(selectedDevices.isAudioEnabled);

        }
    }, [selectedDevices, show, getMediaDevices]);

    const handleDeviceChange = (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
        if (type === "video") {
            setVideoId(deviceId);
        } else if (type === "audioIn") {
            setAudioId(deviceId);
        } else {
            setSpeakerId(deviceId);
        }
    };

    const closeButtonClick = async () => {
        console.log(`closeButtonClick ${isAudioEnabled} ${isVideoEnabled}`);
        switchDevices(videoId, audioId, speakerId, isAudioEnabled, isVideoEnabled);
        handleClose();
    };

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
                                    <Form.Check label="Mic enabled" checked={isAudioEnabled} onChange={(e) => setIsAudioEnabled(e.target.checked)}></Form.Check>


                                    <h5>Video</h5>
                                    {availableDevices.video.length > 0 ? (
                                        <Form.Select
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
                                    <Form.Check label="Camera enabled" checked={isVideoEnabled} onChange={(e) => setIsVideoEnabled(e.target.checked)}></Form.Check>


                                    <h5>Speaker</h5>
                                    {availableDevices.audioOut.length > 0 ? (
                                        <Form.Select
                                            aria-label="Select Speaker"
                                            value={speakerId || ''}
                                            onChange={(e) => handleDeviceChange('audioOut', e.target.value)}
                                            className="mb-3"
                                        >
                                            {/* <option value="">Default Speaker</option> */}
                                            {availableDevices.audioOut.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No speakers found. (Note: Speaker selection support varies by browser)</p>}
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