import VideoStream from './VideoStream';
import './VideoGrid.css'; // Optional CSS module for styling

interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
}

interface VideoGridProps {
  participants: Participant[]; // List of remote participants
}

const VideoGrid: React.FC<VideoGridProps> = ({ participants }) => {
  // Filter out participants without streams
  const validParticipants = participants.filter((p) => p.stream);

  // Calculate grid layout (e.g., 2x2, 3x3) based on participant count
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(validParticipants.length))}, 1fr)`,
    gap: '10px',
    height: '100%',
    padding: '10px',
  };

  return (
    <div style={gridStyle} className="video-grid">
      {validParticipants.map((participant) => (
        <div key={participant.id} className="video-grid-item">
          <VideoStream stream={participant.stream} />
          <div className="participant-name">{participant.name}</div>
        </div>
      ))}
    </div>
  );
};

export default VideoGrid;