import React, { useEffect, useState } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { webRTCService } from '../../services/WebRTCService'; // For online status updates

const CallingPopup: React.FC = () => {
    const { callingContact, cancelOutgoingCall, endCurrentCall } = useCall();
    const [showModal, setShowModal] = useState(true);


    useEffect(() => {

        if (!callingContact) {
            return null;
        }

        webRTCService.onCallEnded = () => {
            setShowModal(false);
            endCurrentCall();
        };

        return () => {
            webRTCService.onCallEnded = null;
        };

    }, [callingContact]);

    return (
        <Modal show={showModal} centered backdrop="static" keyboard={false}>
            <Modal.Header>
                <Modal.Title>Calling...</Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-center">
                <Spinner animation="border" role="status" className="mb-3">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <h4>Calling {callingContact.displayName}</h4>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="danger" onClick={cancelOutgoingCall}>
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CallingPopup;