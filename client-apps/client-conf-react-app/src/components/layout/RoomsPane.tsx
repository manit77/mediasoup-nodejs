import React, { useCallback, useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAuth } from '../../hooks/useAuth';
import { Conference } from '../../types';
import { join } from 'path';


const RoomsPane: React.FC = () => {

    const { joinConference, createConference, conferences, getConferenceRooms, isCallActive, inviteContact, inviteInfo } = useCall();
    const { getConferencesScheduled, getCurrentUser } = useAuth();

    const [loading, setLoading] = useState(false);
    const [conferencesScheduled, setConferencesScheduled] = useState<Conference[]>([]);

    // Handle initial loading state

    const handleRefreshRooms = async () => {
        try {
            setLoading(true);
            let scheduled = await getConferencesScheduled();
            console.log("handleRefreshRooms conferencesScheduled", scheduled);
            setConferencesScheduled(scheduled);
            getConferenceRooms();
            setLoading(false);
        } catch (error) {
            console.error('Failed to refresh rooms:', error);
        }
    };

    useEffect(() => {
        // Initial load of conference rooms
        console.log("RoomsPane useEffect triggered.");
        handleRefreshRooms();
    }, []);

    useEffect(() => {
        //update from conf server
        console.log("conferences updated ", conferences, conferencesScheduled);
        conferencesScheduled.forEach(scheduled => {
            let conf = conferences.find(c => scheduled.id === c.roomTrackingId);
            if (conf) {
                scheduled.conferenceRoomId = conf.conferenceRoomId;
                scheduled.status = conf.roomStatus;
            } else {
                scheduled.status = "";
            }
        });

        setConferencesScheduled([...conferencesScheduled])

    }, [conferences]);

    const handleConferenceClick = async (conference: Conference) => {
        setLoading(true);
        try {
            if(getCurrentUser()?.role === "admin") {
                // Admin can create a new conference and join it
                createConference(conference.id, conference.name);
            } else {
                joinConference(conference.conferenceRoomId);
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
            ) : conferencesScheduled.length === 0 ? (
                <p>No rooms found.</p>
            ) : (
                <ListGroup>
                    {conferencesScheduled.map((scheduled) => (
                        <ListGroup.Item
                            key={scheduled.id}
                            action
                            onClick={() => handleConferenceClick(scheduled)}
                            className="d-flex justify-content-between align-items-center"
                            disabled={isCallActive || !!inviteContact || !!inviteInfo}
                        >
                            {scheduled.name}
                            <Badge pill bg={scheduled.status ? 'success' : 'secondary'} className="ms-2">
                                {scheduled.status ? 'Active' : 'Offline'}
                            </Badge>

                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </div>
    );
};

export default RoomsPane;

