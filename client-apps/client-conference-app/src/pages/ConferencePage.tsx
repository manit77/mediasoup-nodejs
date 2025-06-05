import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import LayoutManager from '../components/conference/LayoutManger';
import ConferenceControls from '../components/conference/ConferenceControls';
import ParticipantList from '../components/conference/ParticipantList';
import './MeetingRoomPage.css';

interface ConferenceInfo {
  roomId: string,
}

const ConferencePage: React.FC<ConferenceInfo> = ({ roomId }) => {
  const { user } = useContext(AuthContext);
  const localStream: MediaStream | null = null;
  const { participants } = useWebRTC(roomId, user.id, localStream);

  return (
    <div className="meeting-room">
      <ConferenceControls />
      <div className="meeting-content">
        <LayoutManager participants={participants} localStream={localStream} />
        <ParticipantList participants={participants} localStream={localStream} />
      </div>
    </div>
  );
};

export default ConferencePage;