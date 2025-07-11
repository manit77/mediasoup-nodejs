import React, { useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { ParticipantInfo } from '@conf/conf-models';

const OnlineIndicator: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
    <Badge pill bg={isOnline ? 'success' : 'secondary'} className="ms-2">
        {isOnline ? 'Online' : 'Offline'}
    </Badge>
);

const ParticipantsOnlinePane: React.FC = () => {

    const { participantsOnline, getParticipantsOnline, sendInvite, isCallActive, inviteContact, inviteInfo, localParticipantId } = useCall();
    const [loading, setLoading] = useState(true);

    // Handle initial loading state
    useEffect(() => {
        if (participantsOnline.length > 0 || localParticipantId) {
            setLoading(false);
        }

        console.warn(`localParticipantId: ${localParticipantId}`);

    }, [participantsOnline, localParticipantId]);

     useEffect(() => {        
        console.warn(`localParticipantId: ${localParticipantId}`);
    }, [localParticipantId]);
    

    // Optional: Function to manually refresh contacts
    const handleRefreshParticipants = async () => {
        setLoading(true);
        try {
            getParticipantsOnline();
        } catch (error) {
            console.error('Failed to refresh contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContactClick = (participant: ParticipantInfo) => {
        if (!isCallActive && !inviteContact && !inviteInfo) {
            sendInvite(participant);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5>Contacts</h5>
                <Button variant="outline-primary" size="sm" onClick={handleRefreshParticipants} disabled={loading}>
                    Refresh
                </Button>
            </div>
            {loading ? (
                <p>Loading contacts...</p>
            ) : participantsOnline.length === 0 ? (
                <p>No contacts found.</p>
            ) : (
                <ListGroup>
                    {participantsOnline.map((participantInfo) => (
                        <ListGroup.Item
                            key={participantInfo.participantId}
                            action
                            onClick={() => handleContactClick(participantInfo)}
                            className="d-flex justify-content-between align-items-center"
                            disabled={isCallActive || !!inviteContact || !!inviteInfo}
                        >
                            {participantInfo.displayName}
                            <OnlineIndicator isOnline={true} />
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </div>
    );
};

export default ParticipantsOnlinePane;