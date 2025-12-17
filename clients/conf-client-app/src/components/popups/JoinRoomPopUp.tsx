import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { ConferenceScheduledInfo, GetUserMediaConfig } from '@conf/conf-models';
import ThrottledButton from '../layout/ThrottledButton';
import { getBrowserUserMedia } from '@conf/conf-client';
import {
    CameraVideo, CameraVideoOff,
    Mic, MicMute,
    Gear, DoorOpen,
    ShieldLock, InfoCircle,
    ExclamationTriangle
} from 'react-bootstrap-icons';


interface JoinRoomPopUpProps {
    conferenceScheduled: ConferenceScheduledInfo;
    show: boolean;
    onClose: () => void;
}

const JoinRoomPopUp: React.FC<JoinRoomPopUpProps> = ({ conferenceScheduled, show, onClose }) => {
    const api = useAPI();
    const ui = useUI();
    const { localParticipant, isCallActive, createOrJoinConference, joinConference, getMediaConstraints, availableDevices, selectedDevices, setSelectedDevices, getMediaDevices, getLocalMedia, isWaiting } = useCall();
    const navigate = useNavigate();

    const [conferenceCode, setConferenceCode] = useState<string>("");
    const [requireConfCode, setRequireConfCode] = useState<boolean>(false);

    const [micEnabled, setMicEnabled] = useState<boolean>(true); // Default to true
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(true); // Default to true
    const [showMicOption, setShowMicOption] = useState<boolean>(true); // Default to true
    const [showCameraOption, setShowCameraOption] = useState<boolean>(true); // Default to true

    const [micName, setMicName] = useState<string>(selectedDevices.audioInLabel);
    const [cameraName, setCameraName] = useState<string>(selectedDevices.videoLabel);

    useEffect(() => {

        if (!conferenceScheduled.config) {
            setRequireConfCode(false);
            console.error('no conference config');
            return;
        }

        const user = api.getCurrentUser();
        if (!user) {
            console.error('no current user');
            return;
        }

        if (user.role === "guest" && conferenceScheduled.config.guestsRequireConferenceCode) {
            setRequireConfCode(true);
        }

        if (user.role === "user" && conferenceScheduled.config.usersRequireConferenceCode) {
            setRequireConfCode(true);
        }

        if (user.role === "admin") {
            setRequireConfCode(false);
        }

        if (user.role === "guest") {
            console.log(`guest user`);

            //guests cannot override conference configs
            //hide the checkboxes for camera and mic
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

            if (conferenceScheduled.config.guestsRequireCamera) {
                localParticipant.tracksInfo.isVideoEnabled = true;
                setCameraEnabled(true);
                setShowCameraOption(false);
            }

            if (conferenceScheduled.config.guestsRequireMic) {
                localParticipant.tracksInfo.isVideoEnabled = true;
                setMicEnabled(true);
                setShowMicOption(false);
            }

        } else {
            //default to mic enabled            
            setMicEnabled(true);
            setCameraEnabled(false);

            localParticipant.tracksInfo.isAudioEnabled = true;
            localParticipant.tracksInfo.isVideoEnabled = false;
        }

        let __getDevices = async () => {
            //get the stream here for browser permissions issues
            //certain browsers tie permissions to a click
            let tempStream = await getBrowserUserMedia(getMediaConstraints(true, true));

            let devices = await getMediaDevices();

        };



    }, [])

    useEffect(() => {
        setMicName(selectedDevices.audioInLabel);
        setCameraName(selectedDevices.videoLabel);
    }, [selectedDevices]);

    // useEffect(() => {

    //     setMicEnabled(true);
    //     setCameraEnabled(false);

    //     localParticipant.tracksInfo.isAudioEnabled = true;
    //     localParticipant.tracksInfo.isAudioEnabled = false;


    // }, [localParticipant])

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

    const handleJoinConf = async (event: React.FormEvent) => {
        event.preventDefault();

        try {
            //make sure we have a stream before making a call

            //up the tracksInfo for localParticipant from the check boxes on the form 
            localParticipant.tracksInfo.isAudioEnabled = micEnabled;
            localParticipant.tracksInfo.isVideoEnabled = cameraEnabled;
            console.log(`localParticipant.tracksInfo`, localParticipant.tracksInfo);

            let joinMediaConfig = new GetUserMediaConfig();
            joinMediaConfig.isAudioEnabled = localParticipant.tracksInfo.isAudioEnabled;
            joinMediaConfig.isVideoEnabled = localParticipant.tracksInfo.isVideoEnabled;
            console.log('conferenceScheduled', conferenceScheduled);

            joinMediaConfig.constraints = getMediaConstraints(joinMediaConfig.isAudioEnabled, joinMediaConfig.isVideoEnabled);

            if (api.isUser()) {
                createOrJoinConference(conferenceScheduled.externalId, conferenceCode, joinMediaConfig);
            } else {
                if (conferenceScheduled.conferenceId) {
                    joinConference(conferenceCode, conferenceScheduled, joinMediaConfig);
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

    const handleSettingsClick = () => {
        ui.setIsShowSettings(true);
    };

    useEffect(() => {
        console.log(`JoinRoomPopUpProps conferenceScheduled`, conferenceScheduled);
    }, [conferenceScheduled]);

    return (
        <Modal show={show} centered backdrop="static" keyboard={false} onHide={onClose} size="lg">
            <Modal.Header closeButton className="bg-body">
                <Modal.Title className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center">
                        <DoorOpen className="me-2 text-primary" size={24} />
                        <span>Join Conference Room</span>
                    </div>
                    <Button variant="outline-secondary" size="sm" onClick={handleSettingsClick} disabled={isWaiting}>
                        <Gear className="me-1" size={14} /> Settings
                    </Button>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <Form>
                    {/* Room Info Section */}
                    <div className="mb-4 p-3 bg-body rounded border-start border-primary border-4">
                        <small className="text-uppercase text-muted fw-bold">Room Name</small>
                        <h5 className="mb-0">{conferenceScheduled.name}</h5>
                    </div>

                    {requireConfCode && (
                        <Form.Group className="mb-4" controlId="conferenceCode">
                            <Form.Label className="fw-bold">
                                <ShieldLock className="me-2" />Access Code
                            </Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-lg"
                                value={conferenceCode}
                                onChange={(e) => setConferenceCode(e.target.value)}
                                placeholder="Enter 5-digit code"
                                required
                                disabled={isWaiting}
                            />
                        </Form.Group>
                    )}

                    <hr />

                    <div className="row">
                        {/* Audio Column */}
                        {showMicOption && (
                            <div className="col-md-6 mb-3">
                                <Form.Group controlId="ctlMicEnabled">
                                    <Form.Check
                                        type="switch" // Switch looks more modern than checkbox
                                        id="mic-switch"
                                        label={micEnabled ? <span><Mic className="me-1" /> Mic On</span> : <span><MicMute className="me-1" /> Mic Off</span>}
                                        checked={micEnabled}
                                        onChange={(e) => toggleMic(e.target.checked)}
                                        disabled={isWaiting}
                                        className="mb-2"
                                    />
                                </Form.Group>
                                <div className={`p-2 rounded small ${!micName ? 'bg-danger-subtle text-danger' : 'bg-body text-muted border'}`}>
                                    {!micName ? (
                                        <><ExclamationTriangle className="me-1" /> No Mic Detected</>
                                    ) : (
                                        <><Mic size={12} className="me-1" /> {micName}</>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Video Column */}
                        {showCameraOption && (
                            <div className="col-md-6 mb-3">
                                <Form.Group controlId="cameraEnabled">
                                    <Form.Check
                                        type="switch"
                                        id="camera-switch"
                                        label={cameraEnabled ? <span><CameraVideo className="me-1" /> Video On</span> : <span><CameraVideoOff className="me-1" /> Video Off</span>}
                                        checked={cameraEnabled && !!cameraName}
                                        onChange={(e) => toggleCamera(e.target.checked)}
                                        disabled={isWaiting || !cameraName}
                                        className="mb-2"
                                    />
                                </Form.Group>
                                <div className={`p-2 rounded small ${!cameraName ? 'bg-danger-subtle text-danger' : 'bg-body text-muted border'}`}>
                                    {!cameraName ? (
                                        <><ExclamationTriangle className="me-1" /> No Camera Detected</>
                                    ) : (
                                        <><CameraVideo size={12} className="me-1" /> {cameraName}</>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Guest Permissions Info */}
                    <div className="mt-4 p-3 border rounded shadow-sm bg-body">
                        <div className="d-flex align-items-center mb-2">
                            <InfoCircle className="text-info me-2" />
                            <span className="fw-bold small text-uppercase text-muted">Room Permissions</span>
                        </div>
                        <div className="row g-0 text-center small">
                            <div className="col border-end">
                                <div className="text-muted">Guest Camera</div>
                                <span className={conferenceScheduled.config.guestsAllowCamera ? "text-success" : "text-danger"}>
                                    {conferenceScheduled.config.guestsAllowCamera ? "Allowed" : "Blocked"}
                                </span>
                            </div>
                            <div className="col">
                                <div className="text-muted">Guest Mic</div>
                                <span className={conferenceScheduled.config.guestsAllowMic ? "text-success" : "text-danger"}>
                                    {conferenceScheduled.config.guestsAllowMic ? "Allowed" : "Blocked"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="d-grid gap-2 mt-4">
                        <ThrottledButton onClick={handleJoinConf} variant="primary" size="lg" disabled={isWaiting}>
                            {isWaiting ? 'Connecting...' : 'Enter Meeting Room'}
                        </ThrottledButton>
                    </div>
                </Form>
            </Modal.Body>

            <Modal.Footer className="border-0 pt-0">
                <Button variant="link" className="text-decoration-none text-muted" onClick={handleCancelClick} disabled={isWaiting}>
                    Cancel and Exit
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default JoinRoomPopUp;