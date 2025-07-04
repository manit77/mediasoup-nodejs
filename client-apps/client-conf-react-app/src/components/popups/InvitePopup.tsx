import React, { useEffect, useState } from 'react';
import { Modal, Button, ListGroup } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { Contact } from '@conf/conf-models';


const InvitePopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const {contacts, sendInvite, participants } = useCall()

    const handleInviteClick = (contact: Contact) => {
        sendInvite(contact);     
    };

    // Filter out contacts already in the call and offline contacts
    const availableToInvite = contacts.filter(contact =>
        contact.participantId && !participants.some(p => p.id === contact.participantId)
    );

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>Invite to Call</Modal.Title>
            </Modal.Header>
            <Modal.Body>                
                {availableToInvite.length === 0 && <p>No online contacts available to invite.</p>}
                {availableToInvite.length > 0 && (
                    <ListGroup>
                        {availableToInvite.map(contact => (
                            <ListGroup.Item key={contact.participantId} className="d-flex justify-content-between align-items-center">
                                {contact.displayName}
                                <Button variant="primary" size="sm" onClick={() => handleInviteClick(contact)}>
                                    Invite
                                </Button>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default InvitePopup;