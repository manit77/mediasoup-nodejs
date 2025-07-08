import React, { useEffect } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';

const CallingPopup: React.FC = () => {
    const { inviteContact, cancelInvite } = useCall();

    return (
        <Modal show={true} centered backdrop="static" keyboard={false}>
            <Modal.Header>
                <Modal.Title>Calling...</Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-center">
                <Spinner animation="border" role="status" className="mb-3">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <h4>Calling {inviteContact.displayName}</h4>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="danger" onClick={cancelInvite}>
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CallingPopup;