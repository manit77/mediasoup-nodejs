import React, { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall';

const MainVideo: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { localParticipant, presenter } = useCall();

    useEffect(() => {
        if (videoRef.current && presenter?.stream) {
            try {
                videoRef.current.srcObject = presenter.stream;
            } catch (error) {
                console.error(error);
            }
        } else if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, [presenter]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            videoRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            {presenter?.stream ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <video onClick={toggleFullscreen}
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={localParticipant.participantId === presenter?.participantId}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '10px',
                            background: 'rgba(0, 0, 0, 0.5)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                        }}
                    >
                        <small>
                            {presenter && presenter === localParticipant ?
                                '(you) are presenting'
                                :
                                `presenter: ${presenter?.displayName}`}
                        </small>
                    </div>
                </div>
            ) : (
                <div
                    className="d-flex align-items-center justify-content-center"
                    style={{ width: '100%', height: '100%' }}
                >
                    <p className="lead">No video Presenter</p>
                </div>
            )}
        </div>
    );
};

export default MainVideo;