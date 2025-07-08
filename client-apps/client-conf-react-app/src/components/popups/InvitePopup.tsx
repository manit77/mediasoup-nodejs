import React, { useEffect, useState } from 'react';
import { Modal, Button, ListGroup } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { ParticipantInfo } from '@conf/conf-models';


const InvitePopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const { participantsOnline, sendInvite, callParticipants } = useCall()

    const handleInviteClick = (participantInfo: ParticipantInfo) => {
        sendInvite(participantInfo);
    };

    // Filter out contacts already in the call and offline contacts
    const availableToInvite = participantsOnline.filter(participant =>
        participant.participantId && !callParticipants.some(p => p.id === participant.participantId)
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
                        {availableToInvite.map(participant => (
                            <ListGroup.Item key={participant.participantId} className="d-flex justify-content-between align-items-center">
                                {participant.displayName}
                                <Button variant="primary" size="sm" onClick={() => handleInviteClick(participant)}>
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