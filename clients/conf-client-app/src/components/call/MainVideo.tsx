import React, { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall';
import { Participant } from '@conf/conf-client';


const MainVideo: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { localParticipant, selectedDevices, presenter } = useCall();

    useEffect(() => {
        console.warn(`MainVideo: presenter changed ${presenter?.displayName}`);
        if (videoRef.current && presenter?.stream) {
            try {
                videoRef.current.srcObject = presenter.stream;
                console.warn("presenter stream set", presenter.stream.getVideoTracks());
            }
            catch (error) {
                console.error(error);
            }
        } else if (videoRef.current) {
            videoRef.current.srcObject = null;
            console.warn("presenter no stream");
        }
    }, [presenter]);

    return (
        <div className="main-video-container bg-black flex-grow-1 d-flex align-items-center justify-content-center h-100">
            {presenter?.stream ? (
                <div>
                    <video ref={videoRef} autoPlay playsInline muted={localParticipant.participantId === presenter?.participantId /* Mute local preview if it's local stream */}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    {
                        presenter && presenter == localParticipant ?
                            <small>(you) are presenting</small>
                            :
                            <small>presenter: {presenter?.displayName}</small>
                    }

                </div>
            ) : (
                <div className="d-flex align-items-center justify-content-center"
                    style={{ width: '100%', height: '100%' }}>
                    <p className="lead"> No video Presenter</p>
                </div>
            )}
        </div>
    );
};

export default MainVideo;