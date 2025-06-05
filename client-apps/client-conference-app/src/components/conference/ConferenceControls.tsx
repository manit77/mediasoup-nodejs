import { useNavigate } from 'react-router-dom';
import './ConferenceControls.css';

interface MeetingControlsProps {
  meetingId: string;
  userId: string;
  localStream: MediaStream | null;
}

const MeetingControls: React.FC<MeetingControlsProps> = ({ meetingId, userId, localStream }) => {
  const navigate = useNavigate();
  const { cleanup } = useWebRTC(meetingId, userId, localStream);

  const handleExit = () => {
    if (cleanup) {
      cleanup(); // Close peer connections and unsubscribe from signaling
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop()); // Stop local media tracks
    }
    navigate('/'); // Redirect to HomePage
  };

  // Optional: Add audio/video toggle controls
  /*
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };
  */

  return (
    <div className="meeting-controls">
      <button onClick={handleExit} className="exit-button">
        Exit Meeting
      </button>
      {/* Optional buttons for audio/video control */}
      {/*
      <button onClick={toggleAudio} className="control-button">
        {isAudioMuted ? 'Unmute' : 'Mute'}
      </button>
      <button onClick={toggleVideo} className="control-button">
        {isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
      </button>
      */}
    </div>
  );
};

export default MeetingControls;