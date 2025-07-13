import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';

const IncomingCallPopup: React.FC = () => {
    const { isCallActive, inviteInfoReceived, acceptInvite, declineInvite } = useCall();
    const navigate = useNavigate();

    useEffect(() => {
        if (isCallActive) {
            console.log("navigate to on-call");
            navigate('/on-call'); // Navigate to call screen
        }

    }, [isCallActive, navigate]);

    const handleAccept = async () => {
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