import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall'; // Assuming this hook provides call-related logic
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';


import { ConferenceRoomScheduled } from '../../types'; // Assuming this type is correctly defined

interface JoinRoomPopUpProps {
    conference: ConferenceRoomScheduled; // Corrected prop destructuring
    show: boolean; // Add a prop to control modal visibility
    onClose: () => void; // Add a prop to handle closing the modal
}

const JoinRoomPopUp: React.FC<JoinRoomPopUpProps> = ({ conference, show, onClose }) => {
    const api = useAPI();
    const ui = useUI();
    const { isCallActive, createConferenceOrJoin, createConference, joinConference, selectedDevices, setSelectedDevices, } = useCall();
    const navigate = useNavigate();

    // State to hold the conference code entered by the user
    const [conferenceCode, setConferenceCode] = useState<string>('');
    // State to manage loading status during API calls
    const [loading, setLoading] = useState<boolean>(false);
    const [micEnabled, setMicEnabled] = useState<boolean>(true); // Default to true
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(true); // Default to true

    const [showMicOption, setShowMicOption] = useState<boolean>(true); // Default to true
    const [showCameraOption, setShowCameraOption] = useState<boolean>(true); // Default to true


    useEffect(() => {
        console.warn("useEffect selectedDevices:", selectedDevices);
        if (selectedDevices) {
            setMicEnabled(selectedDevices.isAudioEnabled)
            setCameraEnabled(selectedDevices.isVideoEnabled);
        }

    }, [selectedDevices])

    useEffect(() => {
        console.warn(`isCallActive`, isCallActive);
        if (isCallActive) {
            console.warn("Navigating to on-call screen.");
            // If the call is active, navigate to the call screen
            navigate('/on-call');
            // Optionally, close the modal once navigation starts
            onClose();
        }
    }, [isCallActive, navigate, onClose]);

    const toggleMic = useCallback((enabled: boolean) => {
        console.warn(`toggleMic`);
        setMicEnabled(enabled);
        setSelectedDevices(prev => {
            return {
                ...prev,
                isAudioEnabled: enabled
            }
        });
    }, [setSelectedDevices]);

    const toggleCamera = useCallback((enabled: boolean) => {
        console.warn(`toggleCamera`);
        setCameraEnabled(enabled);
        setSelectedDevices(prev => {
            return {
                ...prev,
                isVideoEnabled: enabled
            }
        });
    }, [setSelectedDevices]);

    useEffect(() => {
        console.warn(`useEffect guest`);

        let user = api.getCurrentUser();
        if (user.role === "guest") {
            console.warn(`guest user`);
            //guests cannot oveeride conference configs
            if (!conference.config.guestsAllowCamera) {
                setShowCameraOption(false);
            }
            if (!conference.config.guestsAllowMic) {
                setShowMicOption(false);
            }

            toggleMic(false);
            toggleCamera(false);

            return;
        }
    }, [api, conference.config.guestsAllowCamera, conference.config.guestsAllowMic, toggleCamera, toggleMic]);


    const handleJoinRoom = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission behavior

        setLoading(true);
        try {
            if (conference.conferenceRoomId) {

                // Assuming joinConference takes the conference details and the entered code
                joinConference(conference.conferenceRoomId, conferenceCode); // You might need to adjust parameters based on your useCall hook
                // The useEffect above will handle navigation if isCallActive becomes true
            } else {
                let user = api.getCurrentUser();
                if (user.role === "admin" || user.role === "user") {
                    // Admin can create a new conference and join it
                    createConferenceOrJoin(conference.id, conferenceCode);
                }
            }
        } catch (error) {
            console.error('Failed to join conference:', error);
            ui.showPopUp('Failed to join the conference. Please check the code and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelClick = () => {
        onClose(); // Call the onClose prop to hide the modal
    };

    return (
        <Modal show={show} centered backdrop="static" keyboard={false} onHide={onClose}>
            <Modal.Header closeButton> {/* Added closeButton for convenience */}
                <Modal.Title>
                    Join Conference Room
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleJoinRoom}>
                    <Form.Group className="mb-3" controlId="roomName">
                        <Form.Label>Conference Room Name:</Form.Label> {conference.roomName}
                    </Form.Group>
                    {
                        conference.config && conference.config.requireConferenceCode ? (
                            <Form.Group className="mb-3" controlId="conferenceCode">
                                <Form.Label>Enter Conference Code:</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={conferenceCode}
                                    onChange={(e) => setConferenceCode(e.target.value)}
                                    placeholder="e.g., 12345"
                                    required
                                    disabled={loading}
                                />
                            </Form.Group>
                        ) : null
                    }

                    {showMicOption ? (
                        <Form.Group className="mb-3" controlId="micEnabled">
                            <Form.Check
                                type="checkbox"
                                label="Mic Enabled"
                                checked={micEnabled}
                                onChange={(e) => toggleMic(e.target.checked)}
                                disabled={loading}
                            />
                        </Form.Group>
                    ) : null}

                    {showCameraOption ? (
                        <Form.Group className="mb-3" controlId="cameraEnabled">
                            <Form.Check
                                type="checkbox"
                                label="Camera Enabled"
                                checked={cameraEnabled}
                                onChange={(e) => toggleCamera(e.target.checked)}
                                disabled={loading}
                            />
                        </Form.Group>
                    ) : null}


                    <div className="d-grid gap-2 mt-4"> {/* Added margin-top for spacing */}
                        <Button variant="primary" type="submit" disabled={loading}>
                            {loading ? 'Joining...' : 'Join Room'}
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                {/* Only one primary action button is usually needed for form submission.
                    If you want a separate cancel button, it goes here. */}
                <Button variant="secondary" onClick={handleCancelClick} disabled={loading}>
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default JoinRoomPopUp;