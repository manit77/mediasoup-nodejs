import React, { useEffect, useRef } from 'react';
import { useCall } from '../../hooks/useCall';
import { useUI } from '../../hooks/useUI';
import { Participant } from '@conf/conf-client';

const PresenterVideo: React.FC<{ presenter: Participant }> = ({ presenter }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { localParticipant } = useCall();
    const ui = useUI();

    useEffect(() => {
        if (presenter && presenter.stream && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            let timeoutId;

            const video = document.createElement("video");
            video.crossOrigin = "anonymous";
            video.muted = true;
            video.playsInline = true;
            video.srcObject = presenter.stream;


            const draw = () => {
                if (ctx && video && canvas.width > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
                    const canvasRect = canvas.getBoundingClientRect();
                    const canvasDisplayWidth = canvasRect.width;
                    const canvasDisplayHeight = canvasRect.height;

                    const dpr = window.devicePixelRatio || 1;
                    const videoAspectRatio = video.videoWidth / video.videoHeight;
                    const canvasAspectRatio = canvasDisplayWidth / canvasDisplayHeight;

                    let drawWidth, drawHeight, offsetX, offsetY;
                    let canvasPixelWidth, canvasPixelHeight;

                    if (videoAspectRatio > canvasAspectRatio) {
                        canvasPixelWidth = video.videoWidth;
                        canvasPixelHeight = video.videoWidth / canvasAspectRatio;
                        drawWidth = canvasPixelWidth;
                        drawHeight = canvasPixelWidth / videoAspectRatio;
                        offsetX = 0;
                        offsetY = (canvasPixelHeight - drawHeight) / 2;
                    } else {
                        canvasPixelHeight = video.videoHeight;
                        canvasPixelWidth = video.videoHeight * canvasAspectRatio;
                        drawHeight = canvasPixelHeight;
                        drawWidth = canvasPixelHeight * videoAspectRatio;
                        offsetX = (canvasPixelWidth - drawWidth) / 2;
                        offsetY = 0;
                    }

                    canvas.width = Math.round(canvasPixelWidth * dpr);
                    canvas.height = Math.round(canvasPixelHeight * dpr);

                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(dpr, dpr);

                    ctx.clearRect(0, 0, canvasPixelWidth, canvasPixelHeight);
                    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
                }

                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                // Schedule next frame at 15 FPS (1000ms / 15 ≈ 66.67ms)
                timeoutId = setTimeout(() => {
                    requestAnimationFrame(draw);
                }, 66);

            };

            const handleMetadataLoaded = () => {
                console.log(`Video metadata loaded. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
                canvas.style.width = canvas.style.width || "100%";
                canvas.style.height = canvas.style.height || "100%";
                requestAnimationFrame(draw);
            };

            const startDrawing = () => {
                if (!timeoutId) {
                    requestAnimationFrame(draw);
                }
            };

            video.addEventListener("loadedmetadata", handleMetadataLoaded);
            video.addEventListener("canplay", startDrawing);
            video.addEventListener("loadeddata", startDrawing);

            video.play().catch((e) => console.error("Local video element for canvas failed to play:", e));

            return () => {
                clearTimeout(timeoutId);
                video.removeEventListener("loadedmetadata", handleMetadataLoaded);
                video.removeEventListener("canplay", startDrawing);
                video.removeEventListener("loadeddata", startDrawing);
                video.pause();
                video.srcObject = null;
            };
        }
    }, [presenter]);

    const toggleFullscreen = (ele: HTMLElement | any) => {
        console.log(ele);
        if (!document.fullscreenElement) {
            if(ele.requestFullscreen) {
                ele.requestFullscreen().catch((err) => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            }
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            {presenter?.stream ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <canvas id="ctlPresenterCanvas" ref={canvasRef}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();                            
                        }}
                        onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleFullscreen(canvasRef.current);
                        }}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            backgroundColor: 'black'
                        }}>

                    </canvas>
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

export default PresenterVideo;