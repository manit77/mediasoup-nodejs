import VideoStream from './VideoStream';

const ParticipantList = ({ participants, localStream }) => {
  return (
    <div className="participant-list">
      {participants.map((p) => (
        <div key={p.id}>{p.name}</div>
      ))}
      <div className="local-video-participant-list">
        <VideoStream stream={localStream} isLocal />
      </div>
    </div>
  );
};

export default ParticipantList;