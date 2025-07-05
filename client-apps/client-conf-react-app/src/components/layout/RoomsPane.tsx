import React, { useCallback, useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAuth } from '../../hooks/useAuth';
import { Conference } from '../../types';

const OnlineIndicator: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
    <Badge pill bg={isOnline ? 'success' : 'secondary'} className="ms-2">
        {isOnline ? 'Online' : 'Offline'}
    </Badge>
);


const RoomsPane: React.FC = () => {

    const { joinConference, createConference, isCallActive, inviteContact, inviteInfo } = useCall();
    const { getConferences } = useAuth();

    const [loading, setLoading] = useState(true);
    const [conferences, setConferences] = useState<Conference[]>([]);

    // Handle initial loading state

    const handleRefreshRooms = useCallback(async () => {
        setLoading(true);
        try {
            setConferences(await getConferences());
        } catch (error) {
            console.error('Failed to refresh rooms:', error);
        } finally {
            setLoading(false);
        }
    }, [getConferences]);
    
    useEffect(() => {
        handleRefreshRooms();
    }, [handleRefreshRooms]);
    
    const handleConferenceClick = async (conference: Conference) => {
        setLoading(true);
        try {
            if (conference.id) {
                joinConference(conference.id);
            } else {                
                createConference(conference.trackingId);
            }
        } catch (error) {
            console.error('Failed to refresh contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5>Rooms</h5>
                <Button variant="outline-primary" size="sm" onClick={handleRefreshRooms} disabled={loading}>
                    Refresh
                </Button>
            </div>
            {loading ? (
                <p>Loading rooms...</p>
            ) : conferences.length === 0 ? (
                <p>No rooms found.</p>
            ) : (
                <ListGroup>
                    {conferences.map((conference) => (
                        <ListGroup.Item
                            key={conference.trackingId}
                            action
                            onClick={() => handleConferenceClick(conference)}
                            className="d-flex justify-content-between align-items-center"
                            disabled={isCallActive || !!inviteContact || !!inviteInfo}
                        >
                            {conference.name}
                            <OnlineIndicator isOnline={conference.id ? true : false} />
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </div>
    );
};

export default RoomsPane;

