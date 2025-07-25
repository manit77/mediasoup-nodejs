import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../hooks/useUI';

const IncomingCallPopup: React.FC = () => {
    const { isCallActive, inviteInfoReceived, acceptInvite, declineInvite, localParticipant, getLocalMedia, selectedDevices } = useCall();
    const navigate = useNavigate();
    const ui = useUI();

    useEffect(() => {
        if (isCallActive) {
            console.log("navigate to on-call");
            navigate('/on-call'); // Navigate to call screen
        }

    }, [isCallActive, navigate]);

    const handleAccept = async () => {

        if (!localParticipant.stream) {
            console.error(`stream is null`);
            ui.showPopUp("error: media stream not initialized");
            return;
        }

        if (localParticipant?.stream.getTracks().length === 0) {
            console.warn(`media stream not initialized`);
            ui.showToast("media stream not initialized");
            let tracks = await getLocalMedia();
            if (tracks.length === 0) {
                ui.showPopUp("ERROR: could not start media devices.");
                return;
            }

            //up the tracks info for localPart 
            localParticipant.tracksInfo.isAudioEnabled = selectedDevices.isAudioEnabled;
            localParticipant.tracksInfo.isVideoEnabled = selectedDevices.isVideoEnabled;
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
                <Button variant="danger" onClick={handleDecline}>
                    Decline
                </Button>
                <Button variant="success" onClick={handleAccept}>
                    Accept
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default IncomingCallPopup;