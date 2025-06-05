import React, { useEffect, useState } from 'react';
import { Modal, Button, ListGroup } from 'react-bootstrap';
import { ApiService } from '../../services/ApiService'; // To get contact list
import { useCall } from '../../hooks/useCall';
import { webRTCService } from '../../services/WebRTCService'; // For online status updates
import { Contact } from '@conf/conf-models';


const InvitePopup: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const { inviteToOngoingCall, participants } = useCall(); // Get current participants

    useEffect(() => {
        const fetchContactsAndSetStatus = async () => {
            if (show) {
                try {
                    setLoading(true);
                    // const fetchedContacts = await ApiService.getContacts(); // Or from a global state if already fetched
                    // TODO: Get real-time online status from signaling server for these contacts
                    // For now, mock or use initial status
                    // setContacts(fetchedContacts);
                } catch (error) {
                    console.error("Failed to fetch contacts for invite:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchContactsAndSetStatus();
    }, [show]);

    useEffect(() => {
        if (!show) return;
        const handleStatusChange = (participantId: string, isOnline: boolean) => {
            setContacts(prevContacts =>
                prevContacts.map(c => c.participantId === participantId ? { ...c, isOnline } : c)
            );
        };
        //webRTCService.onContactStatusChange = handleStatusChange; // Re-use from ContactsPane or make it global

        return () => {
            //webRTCService.onContactStatusChange = null;
        };
    }, [show]);


    const handleInviteClick = (contact: Contact) => {

        inviteToOngoingCall(contact);
        // Optionally close popup after invite or show "Inviting..."
        // handleClose();
        alert(`Invitation sent to ${contact.displayName}`);
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
                {loading && <p>Loading contacts...</p>}
                {!loading && availableToInvite.length === 0 && <p>No online contacts available to invite.</p>}
                {!loading && availableToInvite.length > 0 && (
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