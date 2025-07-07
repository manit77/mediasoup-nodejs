import React, { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall';

interface MainVideoProps {
    stream: MediaStream | null;
    userId?: string | null; // ID of the user whose stream this is, or "local"
}

const MainVideo: React.FC<MainVideoProps> = ({ stream, userId }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { selectedDevices } = useCall();

    useEffect(() => {
        if (videoRef.current && stream) {
            try {              
                videoRef.current.srcObject = stream;
                // Set speaker if selected (for remote streams mainly, local stream audio output is system default)
                // if (userId !== "local" && selectedDevices.audioOutId && typeof (videoRef.current as any).setSinkId === 'function') {
                //     (videoRef.current as any).setSinkId(selectedDevices.audioOutId);
                // }
            }
            catch (error) {
                console.error(error);
            }
        } else if (videoRef.current) {
            videoRef.current.srcObject = null; // Clear if stream is removed
        }
    }, [stream, selectedDevices.audioOutId, userId]);

    return (
        <div className="main-video-container bg-black flex-grow-1 d-flex align-items-center justify-content-center h-100">
            {stream ? (
                <video ref={videoRef} autoPlay playsInline muted={userId === "local" /* Mute local preview if it's local stream */} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
                <div className="text-center">
                    <p className="lead">No video stream selected or available.</p>
                </div>
            )}
        </div>
    );
};

export default MainVideo;