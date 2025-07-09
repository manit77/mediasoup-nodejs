import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';

const IncomingCallPopup: React.FC = () => {
    const { isCallActive, inviteInfo, acceptInvite, declineInvite, setInviteInfo } = useCall();
    const navigate = useNavigate();

    useEffect(() => {
        if (isCallActive) {
            console.log("navigate to on-call");
            navigate('/on-call'); // Navigate to call screen
        }

    }, [isCallActive]);

    const handleAccept = async () => {
        try {
            await acceptInvite();

        } catch (error) {
            console.error('Failed to accept call:', error);
            alert('Failed to accept call. Please try again.');
            setInviteInfo(null); // Clear the popup on error
        }
    };

    const handleDecline = () => {
        declineInvite(true); // true for isIncomingDecline
        setInviteInfo(null); // Clear the popup
    };

    // Only show modal if there’s an incoming call or the call is active/ended
    if (!inviteInfo) {
        return null;
    }

    return (
        <Modal show={true} centered backdrop="static" keyboard={false}>
            <Modal.Header>
                <Modal.Title>
                    Incoming Call
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <strong>{inviteInfo?.displayName}</strong> is calling you.
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