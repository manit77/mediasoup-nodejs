import React, { useEffect, useState } from 'react';
import { ListGroup, Badge } from 'react-bootstrap';
import { ApiService } from '../../services/ApiService'; // For fetching initial list
import { useCall } from '../../hooks/useCall';
import { webRTCService } from '../../services/WebRTCService'; // For online status updates
import { Contact } from '@conf/conf-models';

// Placeholder for an online indicator icon
const OnlineIndicator: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
    <Badge pill bg={isOnline ? "success" : "secondary"} className="ms-2">
        {isOnline ? 'Online' : 'Offline'}
    </Badge>
);

const ContactsPane: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const { initiateCall, isCallActive, callingContact, incomingCall } = useCall();

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                setLoading(true);
            } catch (error) {
                console.error("Failed to fetch contacts:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContacts();
    }, []);

    useEffect(() => {

        webRTCService.onContactsReceived = (contacts: Contact[]) => {

            console.log("** onContactsReceived", contacts);
            setContacts(contacts);
        }

        // webRTCService.onContactStatusChange = handleStatusChange;
        // Request initial online statuses or rely on signaling server to send them upon connection
        // This might involve sending a message to the signaling server to get current statuses of listed contacts

        return () => {
            webRTCService.onContactsReceived = null;
        };
    }, []);


    const handleContactClick = (contact: Contact) => {
        initiateCall(contact);
    };

    if (loading) return <p>Loading contacts...</p>;

    return (
        <div>
            <h5>Contacts</h5>
            {contacts && contacts.length === 0 && <p>No contacts found.</p>}
            <ListGroup>
                {contacts.map((contact) => (
                    <ListGroup.Item
                        key={contact.participantId}
                        action
                        onClick={() => handleContactClick(contact)}
                        className="d-flex justify-content-between align-items-center"
                    >
                        {contact.displayName}
                        <OnlineIndicator isOnline={contact.participantId > ""} />
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </div>
    );
};

export default ContactsPane;