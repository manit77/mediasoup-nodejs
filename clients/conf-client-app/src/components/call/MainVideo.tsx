import React, { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall';

interface MainVideoProps {
    stream: MediaStream | null;
    participantId?: string | null; // ID of the user whose stream this is, or "local"
}

const MainVideo: React.FC<MainVideoProps> = ({ stream, participantId }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { localParticipant, selectedDevices } = useCall();

    useEffect(() => {
        console.log(`MainVideo: stream changed, videoId: ${selectedDevices.videoId}`);
        if (videoRef.current && stream) {
            try {
                videoRef.current.srcObject = stream;
            }
            catch (error) {
                console.error(error);
            }
        } else if (videoRef.current) {
            videoRef.current.srcObject = null; // Clear if stream is removed
        }
    }, [selectedDevices.videoId, stream, participantId]);

    return (
        <div className="main-video-container bg-black flex-grow-1 d-flex align-items-center justify-content-center h-100">
            {stream ? (
                <video ref={videoRef} autoPlay playsInline muted={localParticipant.participantId === participantId /* Mute local preview if it's local stream */}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
                <div className="text-center">
                    <p className="lead">No video stream selected or available.</p>
                </div>
            )}
        </div>
    );
};

export default MainVideo;