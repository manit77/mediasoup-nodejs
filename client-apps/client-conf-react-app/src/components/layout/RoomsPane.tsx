import React, { useCallback, useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAuth } from '../../hooks/useAuth';
import { ConferenceRoomScheduled } from '../../types';

const RoomsPane: React.FC = () => {
  const { isAuthenticated, isCallActive, inviteInfoSend, conferencesOnline, joinConference, createConference, getConferenceRoomsOnline } = useCall();
  const { conferencesScheduled, fetchConferencesScheduled, getCurrentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [mergedConferences, setMergedConferences] = useState<ConferenceRoomScheduled[]>([]);

  // Handle initial loading state
  useEffect(() => {
    console.log("RoomsPane mounted");
    return () => console.log("RoomsPane unmounted");
  }, []);

  const handleRefreshRooms = useCallback(async () => {
    console.log('handleRefreshRooms:');
    try {
      setLoading(true);
      await fetchConferencesScheduled(); // Assuming this updates conferencesScheduled in context
      setLoading(false);
    } catch (error) {
      console.error('Failed to refresh rooms:', error);
    }
  }, [fetchConferencesScheduled]);

  useEffect(() => {
    // Initial load of conference rooms
    console.log("RoomsPane useEffect triggered.");
    if (isAuthenticated) {
      handleRefreshRooms();
    }
  }, [handleRefreshRooms, isAuthenticated]);

  useEffect(() => {
    // Merge whenever either data source changes
    console.log("Merging conferences ", conferencesOnline, conferencesScheduled);
    const merged = conferencesScheduled.map(scheduled => {
      const conf = conferencesOnline.find(c => scheduled.id === c.roomTrackingId);
      return {
        ...scheduled,
        conferenceRoomId: conf?.conferenceRoomId,
        roomStatus: conf?.roomStatus || "",
      };
    });
    setMergedConferences(merged);
  }, [conferencesOnline, conferencesScheduled]);

  const handleScheduledConferenceClick = async (scheduledConference: ConferenceRoomScheduled) => {
    setLoading(true);
    try {
      if (getCurrentUser()?.role === "admin") {
        // Admin can create a new conference and join it
        createConference(scheduledConference.id, scheduledConference.roomName);
      } else {
        joinConference(scheduledConference.conferenceRoomId);
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
      ) : mergedConferences.length === 0 ? (
        <p>No rooms found.</p>
      ) : (
        <ListGroup>
          {mergedConferences.map((schedule) => (
            <ListGroup.Item
              key={schedule.id}
              action
              onClick={() => handleScheduledConferenceClick(schedule)}
              className="d-flex justify-content-between align-items-center"
              disabled={isCallActive || !!inviteInfoSend || !!inviteInfoSend}
            >
              {schedule.roomName}
              <Badge pill bg={schedule.roomStatus ? 'success' : 'secondary'} className="ms-2">
                {schedule.roomStatus ? 'Active' : 'Offline'}
              </Badge>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  );
};

export default RoomsPane;