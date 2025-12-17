import React, { useCallback, useEffect, useState } from 'react';
import { ListGroup, Badge, Button, Spinner } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { ArrowRepeat, ChevronRight, Circle, CircleFill, DoorOpenFill } from 'react-bootstrap-icons';
import JoinRoomPopUp from '../popups/JoinRoomPopUp';
import { ConferenceScheduledInfo, conferenceLayout } from '@conf/conf-models';

const RoomsPane: React.FC = () => {
  const { isAuthenticated, isCallActive, inviteInfoSend, conferencesOnline } = useCall();
  const { isAdmin, isUser, conferencesScheduled, fetchConferencesScheduled } = useAPI();
  const ui = useUI();

  const [loading, setLoading] = useState(false);
  const [mergedConferences, setMergedConferences] = useState<ConferenceScheduledInfo[]>([]);

  // State to control the visibility of the JoinRoomPopUp
  const [showJoinPopUp, setShowJoinPopUp] = useState(false);
  // State to hold the conference selected by the user to join
  const [selectedConferenceToJoin, setSelectedConferenceToJoin] = useState<ConferenceScheduledInfo | null>(null);

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
    <div className="p-1">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-uppercase text-muted fw-bold small mb-0 tracking-wider">
          Available Conference Rooms
        </h6>
        <Button
          variant="ghost-primary"
          size="sm"
          className="rounded-circle border-0 text-primary"
          onClick={handleRefreshRooms}
          disabled={loading}
        >
          <ArrowRepeat className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">
          <Spinner size="sm" className="me-2" />
          <small>Fetching room status...</small>
        </div>
      ) : mergedConferences.length === 0 ? (
        <div className="text-center py-5 bg-body-tertiary rounded border border-dashed">
          <p className="text-muted mb-0">No active rooms found.</p>
        </div>
      ) : (
        <ListGroup className="rounded border shadow-sm overflow-hidden">
          {mergedConferences.map((schedule) => {
            const isActive = !!schedule.conferenceId;

            return (
              <ListGroup.Item
                key={schedule.externalId}
                action
                onClick={() => handleScheduledConferenceClick(schedule)}
                disabled={isCallActive || !!inviteInfoSend}
                className="d-flex justify-content-between align-items-center px-3 py-3 border-bottom bg-body"
                style={{ transition: 'all 0.2s ease' }}
              >
                {/* Room Icon & Info */}
                <div className="d-flex align-items-center">
                  <div className={`rounded-3 p-3 me-3 d-flex align-items-center justify-content-center ${isActive ? 'bg-success-subtle text-success' : 'bg-light text-muted opacity-50'}`}
                    style={{ width: '52px', height: '52px' }}>
                    <DoorOpenFill size={24} />
                  </div>

                  <div className="d-flex flex-column">
                    <span className="fw-bold text-body fs-6">{schedule.name}</span>
                    <span className="text-muted small text-truncate" style={{ maxWidth: '250px' }}>
                      {schedule.description || "No description provided."}
                    </span>
                  </div>
                </div>

                {/* Status & Entry Action */}
                <div className="d-flex align-items-center">
                  <Badge
                    pill
                    bg={isActive ? 'success-subtle' : 'secondary-subtle'}
                    className={`me-3 border ${isActive ? 'text-success border-success-subtle' : 'text-muted border-secondary-subtle'}`}
                    style={{ fontWeight: '600' }}
                  >
                    {isActive ? (
                      <><CircleFill className="me-1" size={8} /> Active</>
                    ) : (
                      <><Circle className="me-1" size={8} /> Offline</>
                    )}
                  </Badge>

                  {/* Subtle "Go" arrow to indicate clickability */}
                  <ChevronRight className="text-muted opacity-50" size={18} />
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}

      {/* Render the JoinRoomPopUp */}
      {selectedConferenceToJoin && (
        <JoinRoomPopUp
          show={showJoinPopUp}
          onClose={handleCloseJoinPopUp}
          conferenceScheduled={selectedConferenceToJoin}
        />
      )}
    </div>
  );
};

export default RoomsPane;