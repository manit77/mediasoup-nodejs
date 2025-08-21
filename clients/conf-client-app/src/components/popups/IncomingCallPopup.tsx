import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../hooks/useUI';
import { GetUserMediaConfig } from '@conf/conf-models';
import ThrottledButton from '../layout/ThrottledButton';
import { getConferenceConfig } from '../../services/ConferenceConfig';

const IncomingCallPopup: React.FC = () => {
    const { isCallActive, inviteInfoReceived, acceptInvite, declineInvite, localParticipant, getMediaConstraints } = useCall();
    const navigate = useNavigate();
    const ui = useUI();
    const audioRef = useRef<HTMLAudioElement>(null);


    useEffect(() => {
        if (isCallActive) {
            console.log("navigate to on-call");
            navigate('/on-call'); // Navigate to call screen
        }

    }, [isCallActive, navigate]);

    useEffect(() => {
        if (inviteInfoReceived) {
            let config = getConferenceConfig();
            if (config && config.debug_auto_answer) {
                handleAccept(true, true);
            }
        }

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
                console.warn("ring autoplay failed:", err);
            });
        }

    }, [inviteInfoReceived]);

    const handleAccept = async (isAudioEnabled: boolean, isVideoEnabled: boolean) => {

        if (!localParticipant.stream) {
            console.error(`stream is null`);
            ui.showPopUp("error: media stream not initialized");
            return;
        }

        localParticipant.tracksInfo.isAudioEnabled = isAudioEnabled;
        localParticipant.tracksInfo.isVideoEnabled = isVideoEnabled;

        let joinMediaConfig = new GetUserMediaConfig();
        joinMediaConfig.isAudioEnabled = localParticipant.tracksInfo.isAudioEnabled;
        joinMediaConfig.isVideoEnabled = localParticipant.tracksInfo.isVideoEnabled;
        console.warn("accepting invite with ", localParticipant.tracksInfo);

        joinMediaConfig.constraints = getMediaConstraints(joinMediaConfig.isAudioEnabled, joinMediaConfig.isVideoEnabled);

        await acceptInvite(joinMediaConfig);
    };

    const handleDecline = () => {
        declineInvite();
    };

    useEffect(() => {
        console.log("updated inviteInfoReceived", inviteInfoReceived);
    }, [inviteInfoReceived]);

    return (
        <>
            <audio ref={audioRef} src="/ring.wav" loop />
            <Modal show={true} centered backdrop="static" keyboard={false}>
                <Modal.Header>
                    <Modal.Title>
                        Incoming Call
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        <strong>{inviteInfoReceived?.data.displayName}</strong> is calling you.
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <ThrottledButton variant="success" onClick={() => handleAccept(true, false)}>
                        Accept Audio Only
                    </ThrottledButton>
                    <Button variant="success" onClick={() => handleAccept(true, true)}>
                        Accept Audio and Video
                    </Button>
                    <Button variant="danger" onClick={handleDecline}>
                        Decline
                    </Button>

                </Modal.Footer>
            </Modal>
        </>
    );
};

export default IncomingCallPopup;