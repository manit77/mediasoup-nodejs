import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';

const IncomingCallPopup: React.FC = () => {
    const { incomingCall, acceptCall, declineCall, setIncomingCall } = useCall();
    const navigate = useNavigate();

    if (!incomingCall) return null;

    const handleAccept = async () => {
        try {
            await acceptCall();
            navigate('/on-call'); // Navigate to call screen
        } catch (error) {
            console.error("Failed to accept call:", error);
            alert("Failed to accept call. Please try again.");
            setIncomingCall(null); // Clear the popup on error too
        }
    };

    const handleDecline = () => {
        declineCall(true); // true for isIncomingDecline
    };

    return (
        <Modal show={true} centered backdrop="static" keyboard={false}>
            <Modal.Header>
                <Modal.Title>Incoming Call</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p><strong>{incomingCall.displayName}</strong> is calling you.</p>
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