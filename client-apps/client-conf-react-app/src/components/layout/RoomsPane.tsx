import React, { useCallback, useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { ConferenceRoomScheduled } from '../../types';
import { ArrowRepeat, Circle, CircleFill } from 'react-bootstrap-icons';
import JoinRoomPopUp from './JoinRoomPopUp';

const RoomsPane: React.FC = () => {
  const { isAuthenticated, isCallActive, inviteInfoSend, conferencesOnline, getConferenceRoomsOnline, } = useCall();
  const { isAdmin, isUser, conferencesScheduled, fetchConferencesScheduled, getCurrentUser } = useAPI();
  const ui = useUI();

  const [loading, setLoading] = useState(false);
  const [mergedConferences, setMergedConferences] = useState<ConferenceRoomScheduled[]>([]);

  // State to control the visibility of the JoinRoomPopUp
  const [showJoinPopUp, setShowJoinPopUp] = useState(false);
  // State to hold the conference selected by the user to join
  const [selectedConferenceToJoin, setSelectedConferenceToJoin] = useState<ConferenceRoomScheduled | null>(null);

  useEffect(() => {
    console.log("RoomsPane mounted");
    return () => console.log("RoomsPane unmounted");
  }, []);

  const handleRefreshRooms = useCallback(async () => {
    console.log('handleRefreshRooms:');
    try {
      setLoading(true);
      // Fetch both scheduled and online conferences
      await fetchConferencesScheduled(); // Make sure this actually fetches data
      getConferenceRoomsOnline(); // Assuming this fetches data for conferencesOnline
      setLoading(false);
    } catch (error) {
      console.error('Failed to refresh rooms:', error);
      setLoading(false); // Ensure loading is reset even on error
    }
  }, [fetchConferencesScheduled, getConferenceRoomsOnline]); // Added getConferenceRoomsOnline to deps

  useEffect(() => {
    // Initial load of conference rooms
    console.log("RoomsPane useEffect triggered for initial load.");
    if (isAuthenticated) {
      handleRefreshRooms();
    }
  }, [handleRefreshRooms, isAuthenticated]);

  useEffect(() => {
    // Merge whenever either data source changes
    console.log("Merging conferences ", conferencesOnline, conferencesScheduled);

    if (conferencesOnline && conferencesScheduled) {
      console.log("conferencesOnline.length", conferencesOnline.length);

      const merged = conferencesScheduled.map(scheduled => {
        const conf = conferencesOnline.find(conf => scheduled.externalId === conf.externalId);
        return {
          ...scheduled,
          conferenceRoomId: conf?.conferenceRoomId || undefined, // Ensure it's undefined if not found
          roomStatus: conf?.roomStatus || "",
        };
      });
      setMergedConferences(merged);
    }
  }, [conferencesOnline, conferencesScheduled]);

  // Function to handle showing the JoinRoomPopUp
  const handleShowJoinPopUp = (conference: ConferenceRoomScheduled) => {

    if (isAdmin() || isUser() || conference.conferenceRoomId) {
      setSelectedConferenceToJoin(conference);
      setShowJoinPopUp(true);
      return;
    } else {
      console.log(`conference not started. guests cannot create a room.`);
      ui.showToast(`conference ${conference.roomName} not started`);      
    }

  };

  // Function to handle closing the JoinRoomPopUp
  const handleCloseJoinPopUp = () => {
    setShowJoinPopUp(false);
    setSelectedConferenceToJoin(null); // Clear selected conference
  };

  const handleScheduledConferenceClick = async (scheduledConference: ConferenceRoomScheduled) => {    
    console.log(`handleScheduledConferenceClick`, scheduledConference);

    handleShowJoinPopUp(scheduledConference);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5>Rooms</h5>
        <Button variant="outline-primary" size="sm" onClick={handleRefreshRooms} disabled={loading}>
          <ArrowRepeat />
        </Button>
      </div>
      {loading ? (
        <p>Loading rooms...</p>
      ) : mergedConferences.length === 0 ? (
        <p>No rooms available.</p>
      ) : (
        <ListGroup>
          {mergedConferences.map((schedule) => (
            <ListGroup.Item
              key={schedule.externalId}
              action
              // Now passes the schedule to the new handler to show the pop-up
              onClick={() => handleScheduledConferenceClick(schedule)}
              className="d-flex justify-content-between align-items-center"
              // Disable if a call is active or an invite is pending
              disabled={isCallActive || !!inviteInfoSend}
            >
              {schedule.roomName}
              <Badge pill bg={schedule.roomStatus === 'ready' ? 'success' : 'secondary'} className="ms-2">
                {schedule.roomStatus === 'ready' ? (
                  <>
                    <CircleFill /> Active
                  </>
                ) : (
                  <>
                    <Circle /> Offline
                  </>
                )}
              </Badge>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}

      {/* Render the JoinRoomPopUp */}
      {selectedConferenceToJoin && ( // Only render if a conference is selected
        <JoinRoomPopUp
          show={showJoinPopUp}
          onClose={handleCloseJoinPopUp}
          conferenceScheduled={selectedConferenceToJoin}
        // The JoinRoomPopUp will internally use joinConference from useCall
        // and its own micEnabled/cameraEnabled states.
        />
      )}
    </div>
  );
};

export default RoomsPane;