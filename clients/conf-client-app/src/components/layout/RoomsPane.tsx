import React, { useCallback, useEffect, useState } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { ArrowRepeat, Circle, CircleFill } from 'react-bootstrap-icons';
import JoinRoomPopUp from '../popups/JoinRoomPopUp';
import { ConferenceScheduledInfo } from '@conf/conf-models';

const RoomsPane: React.FC = () => {
  const { isAuthenticated, isCallActive, inviteInfoSend, conferencesOnline } = useCall();
  const { isAdmin, isUser, conferencesScheduled, fetchConferencesScheduled, startFetchConferencesScheduled } = useAPI();
  const ui = useUI();

  const [loading, setLoading] = useState(false);
  const [mergedConferences, setMergedConferences] = useState<ConferenceScheduledInfo[]>([]);

  // State to control the visibility of the JoinRoomPopUp
  const [showJoinPopUp, setShowJoinPopUp] = useState(false);
  // State to hold the conference selected by the user to join
  const [selectedConferenceToJoin, setSelectedConferenceToJoin] = useState<ConferenceScheduledInfo | null>(null);

  useEffect(() => {

    startFetchConferencesScheduled();

  }, []);

  useEffect(() => {
    setMergedConferences(conferencesScheduled);
  }, [conferencesScheduled]);


  const handleRefreshRooms = useCallback(async () => {
    //console.log('handleRefreshRooms:');
    try {
      setLoading(true);
      let conferences = await fetchConferencesScheduled();
      setMergedConferences(conferences);
      //console.log(conferences);
      setLoading(false);
    } catch (error) {
      console.error('Failed to refresh rooms:', error);
      setLoading(false);
    }
  }, [fetchConferencesScheduled]);

  useEffect(() => {
    // Initial load of conference rooms
    console.log("RoomsPane useEffect triggered for initial load.");
    if (isAuthenticated) {
      handleRefreshRooms();
    }
  }, [handleRefreshRooms, isAuthenticated]);

  useEffect(() => {
    // Merge whenever either data source changes
    //console.log("Merging conferences ", conferencesOnline, conferencesScheduled);

    if (conferencesOnline && conferencesScheduled) {
      //console.log("conferencesOnline.length", conferencesOnline.length);

      const merged = conferencesScheduled.map(scheduled => {
        const conf = conferencesOnline.find(conf => scheduled.externalId === conf.externalId);
        return {
          ...scheduled,
          conferenceId: conf?.conferenceId || undefined
        };
      });
      setMergedConferences(merged);
    }
  }, [conferencesOnline]);


  // Function to handle showing the JoinRoomPopUp
  const handleShowJoinPopUp = (conference: ConferenceScheduledInfo) => {

    if (isAdmin() || isUser() || conference.conferenceId) {
      setSelectedConferenceToJoin(conference);
      setShowJoinPopUp(true);
      return;
    } else {
      console.log(`conference not started. guests cannot create a room.`);
      ui.showToast(`conference ${conference.name} not started`);
    }

  };

  const handleCloseJoinPopUp = () => {
    setShowJoinPopUp(false);
    setSelectedConferenceToJoin(null);
  };

  const handleScheduledConferenceClick = async (scheduledConference: ConferenceScheduledInfo) => {
    console.log(`handleScheduledConferenceClick`, scheduledConference);

    handleShowJoinPopUp(scheduledConference);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="fw-semibold text-dark">Rooms</h5>
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
              className="d-flex justify-content-between align-items-start py-3"
              // Disable if a call is active or an invite is pending
              disabled={isCallActive || !!inviteInfoSend}
            >
              <div className="d-flex flex-column">
                <span className="fw-semibold fs-5">{schedule.name}</span>
                <span className="description mt-1">{schedule.description}</span>
              </div>
              <Badge pill bg={schedule.conferenceId ? 'success' : 'secondary'} className="ms-3 align-self-center">
                {schedule.conferenceId ? (
                  <>
                    <CircleFill className="me-1" size={10} /> Active
                  </>
                ) : (
                  <>
                    <Circle className="me-1" size={10} /> Offline
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