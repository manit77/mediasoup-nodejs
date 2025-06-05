import { useRef, useEffect } from 'react';

interface VideoStreamProps {
  stream: MediaStream | null; // Media stream (local or remote)
  isLocal?: boolean; // Flag to indicate if this is the local participant's stream
}

const VideoStream: React.FC<VideoStreamProps> = ({ stream, isLocal = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal} // Mute local video to avoid echo
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: '8px',
      }}
    />
  );
};

export default VideoStream;