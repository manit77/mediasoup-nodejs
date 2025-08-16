import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { ConferenceScheduledInfo, GetUserMediaConfig } from '@conf/conf-models';
import ThrottledButton from '../layout/ThrottledButton';


interface JoinRoomPopUpProps {
    conferenceScheduled: ConferenceScheduledInfo;
    show: boolean;
    onClose: () => void;
}

const JoinRoomPopUp: React.FC<JoinRoomPopUpProps> = ({ conferenceScheduled, show, onClose }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, isCallActive, createOrJoinConference, joinConference, getLocalMedia, isWaiting } = useCall();
    const navigate = useNavigate();

    const [conferenceCode, setConferenceCode] = useState<string>("");
    const [requireConfCode, setRequireConfCode] = useState<boolean>(false);

    const [micEnabled, setMicEnabled] = useState<boolean>(true); // Default to true
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(true); // Default to true
    const [showMicOption, setShowMicOption] = useState<boolean>(true); // Default to true
    const [showCameraOption, setShowCameraOption] = useState<boolean>(true); // Default to true


    useEffect(() => {

        if (!conferenceScheduled.config) {
            setRequireConfCode(false);
            return;
        }

        const user = api.getCurrentUser();
        if (!user) {
            return;
        }

        if (user.role === "guest" && conferenceScheduled.config.guestsRequireConferenceCode) {
            setRequireConfCode(true);
            return;
        }

        if (user.role === "user" && conferenceScheduled.config.usersRequireConferenceCode) {
            setRequireConfCode(true);
            return;
        }

        if (user.role === "admin") {
            setRequireConfCode(false);
            return;
        }

    }, [api, conferenceScheduled])

    useEffect(() => {
        console.log("useEffect localParticipant:", localParticipant.tracksInfo);
        setMicEnabled(true);
        setCameraEnabled(false);

        localParticipant.tracksInfo.isAudioEnabled = true;
        localParticipant.tracksInfo.isAudioEnabled = false;


    }, [localParticipant])

    useEffect(() => {
        console.log(`isCallActive`, isCallActive);
        if (isCallActive) {
            console.log("Navigating to on-call screen.");
            navigate('/on-call');
            onClose();
        }
    }, [isCallActive, navigate, onClose]);

    const toggleMic = useCallback((enabled: boolean) => {
        console.log(`toggleMic`);
        localParticipant.tracksInfo.isAudioEnabled = enabled;
        setMicEnabled(enabled);
    }, [localParticipant]);

    const toggleCamera = useCallback((enabled: boolean) => {
        console.log(`toggleCamera`);
        localParticipant.tracksInfo.isVideoEnabled = enabled;
        setCameraEnabled(enabled);
    }, [localParticipant]);

    useEffect(() => {
        console.log(`useEffect guest`);

        let user = api.getCurrentUser();
        if (user.role === "guest") {
            console.log(`guest user`);
            //guests cannot oveeride conference configs
            if (!conferenceScheduled.config.guestsAllowCamera) {
                localParticipant.tracksInfo.isVideoEnabled = false;
                setShowCameraOption(false);
                toggleCamera(false);
            }
            if (!conferenceScheduled.config.guestsAllowMic) {
                localParticipant.tracksInfo.isAudioEnabled = false;
                setShowMicOption(false);
                toggleMic(false);
            }

            return;
        }
    }, [api, conferenceScheduled, localParticipant, toggleCamera, toggleMic]);


    const handleJoinRoom = async (event: React.FormEvent) => {
        event.preventDefault();

        try {
            //make sure we have a stream before making a call

            //up the tracksInfo for localParticipant from the check boxes on the form 
            localParticipant.tracksInfo.isAudioEnabled = micEnabled;
            localParticipant.tracksInfo.isVideoEnabled = cameraEnabled;
            console.log(`localParticipant.tracksInfo`, localParticipant.tracksInfo);

            let getUserMediaConfig = new GetUserMediaConfig();
            getUserMediaConfig.isAudioEnabled = localParticipant.tracksInfo.isAudioEnabled;
            getUserMediaConfig.isVideoEnabled = localParticipant.tracksInfo.isVideoEnabled;

            let tracks = await getLocalMedia(getUserMediaConfig);
            if (tracks.length === 0) {
                console.warn(`joining with no media`);
            }

            console.log('conferenceScheduled', conferenceScheduled);

            if (api.isUser()) {
                createOrJoinConference(conferenceScheduled.externalId, conferenceCode);
            } else {
                if (conferenceScheduled.conferenceId) {
                    joinConference(conferenceCode, conferenceScheduled);
                } else {
                    ui.showToast("conference is not active.");
                }
            }
        } catch (error) {
            console.error('Failed to join conference:', error);
            ui.showPopUp('Failed to join the conferenceScheduled. Please try again.');
        } finally {

        }
    };

    const handleCancelClick = () => {
        onClose();
    };

    useEffect(() => {
        console.log(`JoinRoomPopUpProps conferenceScheduled`, conferenceScheduled);
    }, [conferenceScheduled]);

    return (
        <Modal show={show} centered backdrop="static" keyboard={false} onHide={onClose}>
            <Modal.Header closeButton> {/* Added closeButton for convenience */}
                <Modal.Title>
                    Join Conference Room
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group className="mb-3" controlId="roomName">
                        <Form.Label>Conference Room Name:</Form.Label> {conferenceScheduled.name}
                    </Form.Group>
                    {
                        requireConfCode ? (
                            <Form.Group className="mb-3" controlId="conferenceCode">
                                <Form.Label>Enter Conference Code:</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={conferenceCode}
                                    onChange={(e) => setConferenceCode(e.target.value)}
                                    placeholder="e.g., 12345"
                                    required
                                    disabled={isWaiting}
                                />
                            </Form.Group>
                        ) : null
                    }

                    {showMicOption ? (
                        <Form.Group className="mb-3" controlId="micEnabled">
                            <Form.Check
                                type="checkbox"
                                label="Join with Microphone Enabled"
                                checked={micEnabled}
                                onChange={(e) => toggleMic(e.target.checked)}
                                disabled={isWaiting}
                            />
                        </Form.Group>
                    ) : null}


                    {showCameraOption ? (
                        <Form.Group className="mb-3" controlId="cameraEnabled">
                            <Form.Check
                                type="checkbox"
                                label="Join with Camera Enabled"
                                checked={cameraEnabled}
                                onChange={(e) => toggleCamera(e.target.checked)}
                                disabled={isWaiting}
                            />
                        </Form.Group>
                    ) : null}

                    {/* {
                        api.isAdmin() || api.isUser() ? ( */}
                    <div className="row">
                        <div className="col-md-6">
                            {/* <strong>Local Audio Enabled:</strong> {localParticipant.tracksInfo.isAudioEnabled.toString()}  <br /> */}
                            <strong>Guests Allow Camera:</strong> {conferenceScheduled.config.guestsAllowCamera.toString()}
                        </div>
                        <div className="col-md-6">
                            {/* <strong>Local video Enabled</strong>: {localParticipant.tracksInfo.isVideoEnabled.toString()}  <br /> */}
                            <strong>Guests Allow Mic:</strong> {conferenceScheduled.config.guestsAllowMic.toString()}
                        </div>
                    </div>
                    {/* ) : null
                    } */}

                    <div className="d-grid gap-2 mt-4"> {/* Added margin-top for spacing */}
                        <ThrottledButton onClick={handleJoinRoom} variant="primary" disabled={isWaiting}>
                            {isWaiting ? 'Joining...' : 'Join Room'}
                        </ThrottledButton>
                    </div>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                {/* Only one primary action button is usually needed for form submission.
                    If you want a separate cancel button, it goes here. */}
                <Button variant="secondary" onClick={handleCancelClick} disabled={isWaiting}>
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default JoinRoomPopUp;