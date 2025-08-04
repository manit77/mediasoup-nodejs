import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../hooks/useUI';
import { GetUserMediaConfig } from '@conf/conf-models';

const IncomingCallPopup: React.FC = () => {
    const { isCallActive, inviteInfoReceived, acceptInvite, declineInvite, localParticipant, getLocalMedia } = useCall();
    const navigate = useNavigate();
    const ui = useUI();

    useEffect(() => {
        if (isCallActive) {
            console.log("navigate to on-call");
            navigate('/on-call'); // Navigate to call screen
        }

    }, [isCallActive, navigate]);

    const handleAccept = async (isAudioEnabled: boolean, isVideoEnabled: boolean) => {

        if (!localParticipant.stream) {
            console.error(`stream is null`);
            ui.showPopUp("error: media stream not initialized");
            return;
        }

        localParticipant.tracksInfo.isAudioEnabled = isAudioEnabled;
        localParticipant.tracksInfo.isVideoEnabled = isVideoEnabled;

        if (localParticipant?.stream.getTracks().length === 0) {
            console.log(`no, steam getting new media stream`);
            ui.showToast("getting media stream");
         
            let getUserMediaConfig = new GetUserMediaConfig();
            getUserMediaConfig.isAudioEnabled = localParticipant.tracksInfo.isAudioEnabled;
            getUserMediaConfig.isVideoEnabled = localParticipant.tracksInfo.isVideoEnabled;

            let tracks = await getLocalMedia(getUserMediaConfig);
            if (tracks.length === 0) {
                ui.showPopUp("ERROR: could not get media stream.");
                return;
            }
        }

        await acceptInvite();
    };

    const handleDecline = () => {
        declineInvite();
    };

    useEffect(() => {
        console.log("updated inviteInfoReceived", inviteInfoReceived);
    }, [inviteInfoReceived]);

    return (
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
                <Button variant="success" onClick={() => handleAccept(true, false)}>
                    Accept Audio Only
                </Button>
                <Button variant="success" onClick={() => handleAccept(true, true)}>
                    Accept Audio and Video
                </Button>
                <Button variant="danger" onClick={handleDecline}>
                    Decline
                </Button>

            </Modal.Footer>
        </Modal>
    );
};

export default IncomingCallPopup;