import VideoStream from './VideoStream';
import VideoGrid from './VideoGrid';

const LayoutManager = ({ participants, localStream }) => {
  const participantCount = participants.length;

  if (participantCount === 0) {
    // Single participant (local only)
    return <VideoStream stream={localStream} isLocal />;
  } else if (participantCount === 1) {
    // Two participants
    return (
      <div className="two-participant-layout">
        <VideoStream stream={participants[0].stream} />
        <div className="local-video-bottom-right">
          <VideoStream stream={localStream} isLocal />
        </div>
      </div>
    );
  } else {
    // Multiple participants
    return <VideoGrid participants={participants} />;
  }
};

export default LayoutManager;