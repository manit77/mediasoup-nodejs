import React, { useEffect } from 'react';
import { Modal, Button, Form, ListGroup, Tab, Row, Col, Nav } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall'; // Assuming settings are also relevant during a call

const SettingsPopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const {
        availableDevices,
        selectedDevices,
        updateMediaDevices,
        switchDevice,
        startScreenShare, // For screen selection part
    } = useCall();

    useEffect(() => {
        if (show) {
            updateMediaDevices();
        }
    }, [show, updateMediaDevices]);

    const handleDeviceChange = (type: 'video' | 'audioIn' | 'audioOut', deviceId: string) => {
        switchDevice(type, deviceId);
    };

    const handleScreenShareSelect = async () => {
        // The actual screen selection happens via browser's picker
        await startScreenShare();
        // No need to list screens here as getDisplayMedia handles it
        // This section could be simplified or used to confirm action
        alert("Screen sharing initiated. Use browser prompt to select screen.");
        handleClose(); // Close settings after initiating
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
                                <Nav.Item>
                                    <Nav.Link eventKey="screenShare">Screen Share</Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </Col>
                        <Col sm={9}>
                            <Tab.Content>
                                <Tab.Pane eventKey="devices">
                                    <h5>Camera</h5>
                                    {availableDevices.video.length > 0 ? (
                                        <Form.Select
                                            aria-label="Select Camera"
                                            value={selectedDevices.videoId || ''}
                                            onChange={(e) => handleDeviceChange('video', e.target.value)}
                                            className="mb-3"
                                        >
                                            {availableDevices.video.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No cameras found.</p>}

                                    <h5>Microphone</h5>
                                    {availableDevices.audioIn.length > 0 ? (
                                        <Form.Select
                                            aria-label="Select Microphone"
                                            value={selectedDevices.audioInId || ''}
                                            onChange={(e) => handleDeviceChange('audioIn', e.target.value)}
                                            className="mb-3"
                                        >
                                            {availableDevices.audioIn.map(device => (
                                                <option key={device.id} value={device.id}>{device.label}</option>
                                            ))}
                                        </Form.Select>
                                    ) : <p>No microphones found.</p>}

                                    <h5>Speaker</h5>
                                    {availableDevices.audioOut.length > 0 ? (
                                        <Form.Select
                                            aria-label="Select Speaker"
                                            value={selectedDevices.audioOutId || ''}
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

                                <Tab.Pane eventKey="screenShare">
                                    <h5>Select Screen to Share</h5>
                                    <p>When you click "Start Screen Sharing", your browser will prompt you to choose which screen, window, or tab to share.</p>
                                    <Button variant="primary" onClick={handleScreenShareSelect}>
                                        Start Screen Sharing
                                    </Button>
                                </Tab.Pane>
                            </Tab.Content>
                        </Col>
                    </Row>
                </Tab.Container>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SettingsPopup;