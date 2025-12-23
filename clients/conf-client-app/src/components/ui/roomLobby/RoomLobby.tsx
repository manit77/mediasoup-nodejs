import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Form, Card, Badge } from 'react-bootstrap';
import { useCall } from '@client/hooks/useCall';
import { useNavigate, useParams } from 'react-router-dom';
import { useAPI } from '@client/hooks/useAPI';
import { useUI } from '@client/hooks/useUI';
import { ConferenceScheduledInfo, GetUserMediaConfig } from '@conf/conf-models';
import ThrottledButton from '../ThrottledButton';
import { getBrowserUserMedia } from '@conf/conf-client';
import {
    CameraVideo, CameraVideoOff,
    Mic, MicMute,
    Gear, DoorOpen,
    ShieldLock, InfoCircle,
    ExclamationTriangle,
    CircleFill,
    Circle
} from 'react-bootstrap-icons';
import SettingsPopup from '../../popups/SettingsPopup';

interface RoomLobbyProps {
    conferenceScheduled?: ConferenceScheduledInfo;
}

const RoomLobby: React.FC<RoomLobbyProps> = ({ conferenceScheduled }) => {
    const api = useAPI();
    const ui = useUI();
    const { conferencesOnline, localParticipant, isCallActive, createOrJoinConference, joinConference, getMediaConstraints, selectedDevices, getMediaDevices, isWaiting } = useCall();
    const navigate = useNavigate();

    const [conferenceCode, setConferenceCode] = useState<string>("");
    const [requireConfCode, setRequireConfCode] = useState<boolean>(false);

    const [micEnabled, setMicEnabled] = useState<boolean>(true); // Default to true
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(true); // Default to true
    const [showMicOption, setShowMicOption] = useState<boolean>(true); // Default to true
    const [showCameraOption, setShowCameraOption] = useState<boolean>(true); // Default to true

    const [micName, setMicName] = useState<string>(selectedDevices.audioInLabel);
    const [cameraName, setCameraName] = useState<string>(selectedDevices.videoLabel);
    const { trackingId } = useParams();
    const [isComponentLoading, setIsComponentLoading] = useState<boolean>(true);

    const [conference, setConference] = useState<ConferenceScheduledInfo | null>(null);

    useEffect(() => {
        if (conferenceScheduled != null) {
            setConference(conferenceScheduled);
            setIsComponentLoading(false);
        } else {

            setIsComponentLoading(true);
            let __load = async () => {
                if (!conferenceScheduled && !trackingId) {
                    console.error('invalid room lobby props');
                    setIsComponentLoading(false);
                    return;
                }

                if (!conferenceScheduled && trackingId) {

                    let scheduled = api.conferencesScheduled.find(c => c.externalId === trackingId);
                    if (!scheduled) {
                        console.error('cannot find scheduled conference for id ', trackingId);

                        scheduled = await api.fetchConferenceScheduled(trackingId);
                        if (!scheduled) {
                            console.error('cannot fetch scheduled conference for id ', trackingId);
                            setIsComponentLoading(false);
                            return;
                        }
                    }
                    conferenceScheduled = scheduled;
                }

                if (!conferenceScheduled.config) {
                    setRequireConfCode(false);
                    console.error('no conference config');
                    setIsComponentLoading(false);
                    return;
                }

                const user = api.getCurrentUser();
                if (!user) {
                    console.error('no current user');
                    setIsComponentLoading(false);
                    return;
                }

                let tempStream = await getBrowserUserMedia(getMediaConstraints(true, true));
                let devices = await getMediaDevices();

                setMicName(selectedDevices.audioInLabel);
                setCameraName(selectedDevices.videoLabel);

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

                setConference(conferenceScheduled);
                setIsComponentLoading(false);
            };

            __load();
        }
    }, [conferenceScheduled]);


    useEffect(() => {
        setMicName(selectedDevices.audioInLabel);
        setCameraName(selectedDevices.videoLabel);
    }, [selectedDevices]);

    useEffect(() => {

        if (conferencesOnline.length === 0) {
            setConference(prev => prev
                ? { ...prev, conferenceId: "" }
                : undefined
            );
            return;
        }

        let conf = conferencesOnline.find(conf => {
            if (conf.externalId === conference?.externalId) {
                return true;
            }
        });
        if (conf) {
            setConference(conf);
        } else {
            setConference(prev => prev
                ? { ...prev, conferenceId: "" }
                : undefined
            );
        }
    }, [conferencesOnline]);

    useEffect(() => {
        console.log(`isCallActive`, isCallActive);
        if (isCallActive) {
            console.log("Navigating to on-call screen.");
            navigate('/on-call');
        }
    }, [isCallActive, navigate]);

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
            console.log('conference', conference);

            joinMediaConfig.constraints = getMediaConstraints(joinMediaConfig.isAudioEnabled, joinMediaConfig.isVideoEnabled);

            if (api.isUser()) {
                createOrJoinConference(conference.externalId, conferenceCode, joinMediaConfig);
            } else {
                if (conference.conferenceId) {
                    joinConference(conferenceCode, conference, joinMediaConfig);
                } else {
                    ui.showToast("conference is not active.");
                }
            }
        } catch (error) {
            console.error('Failed to join conference:', error);
            ui.showPopUp('Failed to join conference. Please try again.');
        } finally {

        }
    };

    const handleSettingsClick = () => {
        ui.setIsShowSettings(true);
    };

    const handleCloseSettings = () => {
        ui.setIsShowSettings(false);
    };

    return (
        (!conference && !trackingId) ? (<><h2>Invalid Lobby Params</h2></>) :
            isComponentLoading ? (<><h2>Loading...</h2></>)
                : conference ?
                    (
                        <Card className="shadow-lg border-0">
                            <Card.Body>
                                <Form>
                                    {/* Room Info Section */}
                                    <div className="mb-4 p-3 bg-body rounded border-start border-primary border-4">
                                        <small className="text-uppercase text-muted fw-bold">Room Name</small>
                                        <h5 className="mb-0">{conference.name}</h5>
                                        <Badge
                                            pill
                                            bg={conference?.conferenceId ? 'success-subtle' : 'secondary-subtle'}
                                            className={`me-3 border ${conference?.conferenceId ? 'text-success border-success-subtle' : 'text-muted border-secondary-subtle'}`}
                                            style={{ fontWeight: '600' }}
                                        >
                                            {conference?.conferenceId ? (
                                                <><CircleFill className="me-1" size={8} /> Active</>
                                            ) : (
                                                <><Circle className="me-1" size={8} /> Offline</>
                                            )}
                                        </Badge>
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
                                                <span className={conference.config.guestsAllowCamera ? "text-success" : "text-danger"}>
                                                    {conference.config.guestsAllowCamera ? "Allowed" : "Blocked"}
                                                </span>
                                            </div>
                                            <div className="col">
                                                <div className="text-muted">Guest Mic</div>
                                                <span className={conference.config.guestsAllowMic ? "text-success" : "text-danger"}>
                                                    {conference.config.guestsAllowMic ? "Allowed" : "Blocked"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-grid gap-2 mt-4">
                                        <ThrottledButton onClick={handleJoinConf} variant="primary" size="lg" disabled={isWaiting}>
                                            {isWaiting ? 'Connecting...' : 'Enter Room'}
                                        </ThrottledButton>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    ) : <></>
    );
};

export default RoomLobby;