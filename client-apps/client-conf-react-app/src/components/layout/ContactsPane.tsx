import React, { useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { Contact } from '@conf/conf-models';

const OnlineIndicator: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
    <Badge pill bg={isOnline ? 'success' : 'secondary'} className="ms-2">
        {isOnline ? 'Online' : 'Offline'}
    </Badge>
);

const ContactsPane: React.FC = () => {
    
    const { contacts, getContacts, sendInvite, isCallActive, inviteContact, inviteInfo, localParticipantId } = useCall();
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
            getContacts();           
        } catch (error) {
            console.error('Failed to refresh contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContactClick = (contact: Contact) => {
        if (!isCallActive && !inviteContact && !inviteInfo) {
            sendInvite(contact);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5>Contacts</h5>
                <Button variant="outline-primary" size="sm" onClick={handleRefreshContacts} disabled={loading}>
                    Refresh
                </Button>
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
                            disabled={isCallActive || !!inviteContact || !!inviteInfo}
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