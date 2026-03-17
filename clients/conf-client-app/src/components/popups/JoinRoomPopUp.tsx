import React, { use, useCallback, useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '@client/contexts/APIContext';
import { useUI } from '@client/contexts/UIContext';
import { ConferenceScheduledInfo, GetUserMediaConfig } from '@conf/conf-models';
import RoomLobby from '@client/components/ui/roomLobby/RoomLobby';
import { DoorOpen, Gear } from 'react-bootstrap-icons';
import '@client/css/modal.css';
import '@client/css/buttons.css';
import { useDevice } from '@client/contexts/DeviceContext';
import { useCall } from '@client/contexts/CallContext';

interface JoinRoomPopUpProps {
    conferenceScheduled: ConferenceScheduledInfo;
    show: boolean;
    onClose: () => void;
}

const JoinRoomPopUp: React.FC<JoinRoomPopUpProps> = ({ conferenceScheduled, show, onClose }) => {
    const api = useAPI();
    const ui = useUI();
    const call = useCall();
    const device = useDevice();

    const navigate = useNavigate();
    const [joinAction, setJoinAction] = useState<(() => void) | null>(null);

    const [conferenceCode, setConferenceCode] = useState<string>("");
    const [requireConfCode, setRequireConfCode] = useState<boolean>(false);

    const [micEnabled, setMicEnabled] = useState<boolean>(true); // Default to true
    const [cameraEnabled, setCameraEnabled] = useState<boolean>(true); // Default to true
 
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
                call.localParticipant.tracksInfo.isVideoEnabled = false;
                toggleCamera(false);
            }
            if (!conferenceScheduled.config.guestsAllowMic) {
                call.localParticipant.tracksInfo.isAudioEnabled = false;
                toggleMic(false);
            }

            if (conferenceScheduled.config.guestsRequireCamera) {
                call.localParticipant.tracksInfo.isVideoEnabled = true;
                setCameraEnabled(true);
            }

            if (conferenceScheduled.config.guestsRequireMic) {
                call.localParticipant.tracksInfo.isVideoEnabled = true;
                setMicEnabled(true);
            }

        } else {
            //default to mic enabled            
            setMicEnabled(true);
            setCameraEnabled(false);

            call.localParticipant.tracksInfo.isAudioEnabled = true;
            call.localParticipant.tracksInfo.isVideoEnabled = false;
        }
        
    }, []);

    useEffect(() => {
        console.log(`isCallActive`, call.isCallActive);
        if (call.isCallActive) {
            console.log("Navigating to on-call screen.");
            navigate('/on-call');
            onClose();
        }
    }, [call.isCallActive, navigate, onClose]);

    const toggleMic = useCallback((enabled: boolean) => {
        console.log(`toggleMic`);
        call.localParticipant.tracksInfo.isAudioEnabled = enabled;
        setMicEnabled(enabled);
    }, [call.localParticipant]);

    const toggleCamera = useCallback((enabled: boolean) => {
        console.log(`toggleCamera`);
        call.localParticipant.tracksInfo.isVideoEnabled = enabled;
        setCameraEnabled(enabled);
    }, [call.localParticipant]);
  
    const handleCancelClick = () => {
        onClose();
    };

    const handleSettingsClick = () => {
        ui.setIsShowSettings(true);
    };

    const handleJoinActionReady = useCallback((action: () => void) => {
        setJoinAction(() => action);
    }, []);

    useEffect(() => {
        console.log(`JoinRoomPopUpProps conferenceScheduled`, conferenceScheduled);
    }, [conferenceScheduled]);

    return (
        <Modal show={show} centered backdrop="static" keyboard={false} onHide={onClose} size="lg" scrollable dialogClassName="join-room-modal">
            <Modal.Header closeButton onHide={onClose} className="bg-body">
                <Modal.Title className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center">
                        <DoorOpen className="me-2 text-primary" size={24} />
                        <span>Conference Lobby</span>
                    </div>
                    <Button variant="outline-secondary" size="sm" onClick={handleSettingsClick} disabled={call.isCallActive}>
                        <Gear className="me-1" size={14} /> Settings
                    </Button>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <RoomLobby
                    conferenceScheduled={conferenceScheduled}
                    showJoinButton={false}
                    onJoinActionReady={handleJoinActionReady}
                />
            </Modal.Body>

            <Modal.Footer className="border-0 pt-0">
                <div className="d-flex align-items-center justify-content-end gap-2 w-100">
                    <Button variant="primary" className="submit-btn px-4 shadow-sm" onClick={() => joinAction && joinAction()} disabled={call.isCallActive || !joinAction}>
                        {call.isCallActive ? 'Connecting...' : 'Enter Room'}
                    </Button>
                    <Button variant="link" className="text-decoration-none text-muted" onClick={handleCancelClick} disabled={call.isCallActive}>
                        Cancel
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default JoinRoomPopUp;