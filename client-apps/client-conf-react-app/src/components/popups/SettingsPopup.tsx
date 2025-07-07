import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, ListGroup, Tab, Row, Col, Nav } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall'; // Assuming settings are also relevant during a call

const SettingsPopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const {
        availableDevices,
        selectedDevices,
        updateMediaDevices,
        switchDevices,
        cameraEnabled, setCameraEnabled,
        micEnabled, setMicEnabled,
    } = useCall();

    const [audioId, setaudioId] = useState("true");
    const [videoId, setvideoId] = useState("true");
    const [speakerId, setspeakerId] = useState("true");


    useEffect(() => {
        if (show) {
            updateMediaDevices();

            setaudioId(selectedDevices.audioInId);
            setvideoId(selectedDevices.videoId);
            setspeakerId(selectedDevices.audioOutId);

        }
    }, [selectedDevices.audioInId, selectedDevices.audioOutId, selectedDevices.videoId, show, updateMediaDevices]);

    const handleDeviceChange = (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
        if (type === "video") {
            setvideoId(deviceId);
        } else if (type === "audioIn") {
            setaudioId(deviceId);
        } else {
            setspeakerId(deviceId);
        }
    };

    const closeButtonClick = async () => {
        switchDevices(videoId, audioId, speakerId);
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
                                    <h5>Camera</h5>
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
                                    <Form.Check label="Camera enabled" checked={cameraEnabled} onChange={(e) => setCameraEnabled(e.target.checked)}></Form.Check>

                                    <h5>Microphone</h5>
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
                                    <Form.Check label="Mic enabled" checked={micEnabled} onChange={(e) => setMicEnabled(e.target.checked)}></Form.Check>

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