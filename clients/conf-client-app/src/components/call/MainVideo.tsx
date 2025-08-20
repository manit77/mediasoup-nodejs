import React, { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall';
import { useUI } from '../../hooks/useUI';
import { Participant } from '@conf/conf-client';

const MainVideo: React.FC<{ presenter: Participant }> = ({ presenter }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { localParticipant } = useCall();
    const ui = useUI();

    useEffect(() => {
        console.warn("presenter triggered");

        if (presenter && videoRef.current) {
            try {

                // if (videoRef.current.srcObject == null) {
                //     let tracks = presenter.stream.getTracks().filter(t => t.readyState == "live");
                //     if (tracks.length == 0) {
                //         console.warn("no tracks for presenter");
                //         return;
                //     }

                //     videoRef.current.srcObject = new MediaStream(presenter.stream.getTracks());
                //     console.warn("presenter srcObject set, ", videoRef.current.srcObject.getTracks());
                // }

                if (videoRef.current.srcObject != presenter.stream) {
                    videoRef.current.srcObject = presenter.stream;
                    console.warn("presenter srcObject set, ", videoRef.current.srcObject.getTracks());
                }

                videoRef.current.muted = localParticipant.participantId === presenter?.participantId;

                if (videoRef.current.srcObject != null) {
                    videoRef.current.play().then(() => {
                        ui.showToast("playing presenter video", "warning");
                    }).catch(err => {
                        console.error(`unable to play presenter video ${err.toString()}`, err);
                        ui.showToast("unable to play presenter video", "error");
                    });
                }

            } catch (error) {
                console.error(error);
                ui.showToast(error.toString(), "error");
            }
        } else if (videoRef.current) {
            videoRef.current.srcObject = null;
            console.error(`no stream availaible`, "error");
        }
        return () => {
            console.warn(`dispose video triggered.`);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [presenter]);

    const toggleFullscreen = (ele: HTMLElement | any) => {
        if (!document.fullscreenElement) {
            ele.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            {presenter?.stream ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <video onClick={(event) => { toggleFullscreen(event.target["parentElement"]) }}
                        ref={videoRef}
                        playsInline
                        muted={true}
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