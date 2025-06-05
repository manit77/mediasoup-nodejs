import React, { useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { Contact } from '@conf/conf-models';
import { webRTCService } from '../../services/WebRTCService';


const OnlineIndicator: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
    <Badge pill bg={isOnline ? 'success' : 'secondary'} className="ms-2">
        {isOnline ? 'Online' : 'Offline'}
    </Badge>
);

const ContactsPane: React.FC = () => {
    const { contacts, setContacts, initiateCall, isCallActive, callingContact, incomingCall, localParticipantId } =
        useCall();
    const [loading, setLoading] = useState(true);

    // Handle initial loading state
    useEffect(() => {
        if (contacts.length > 0 || localParticipantId) {
            setLoading(false);
        }
    }, [contacts, localParticipantId]);

    // Optional: Function to manually refresh contacts
    const handleRefreshContacts = async () => {
        setLoading(true);
        try {
            // Assuming webRTCService has a method to request contacts
            // await webRTCService.getContacts();
            // onContactsReceived will update the contacts state via CallProvider
        } catch (error) {
            console.error('Failed to refresh contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContactClick = (contact: Contact) => {
        if (!isCallActive && !callingContact && !incomingCall) {
            initiateCall(contact);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5>Contacts</h5>
                {/* <Button variant="outline-primary" size="sm" onClick={handleRefreshContacts} disabled={loading}>
                    Refresh
                </Button> */}
            </div>
            {loading ? (
                <p>Loading contacts...</p>
            ) : contacts.length === 0 ? (
                <p>No contacts found.</p>
            ) : (
                <ListGroup>
                    {contacts.map((contact) => (
                        <ListGroup.Item
                            key={contact.participantId}
                            action
                            onClick={() => handleContactClick(contact)}
                            className="d-flex justify-content-between align-items-center"
                            disabled={isCallActive || !!callingContact || !!incomingCall}
                        >
                            {contact.displayName}
                            <OnlineIndicator isOnline={true} />
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </div>
    );
};

export default ContactsPane;