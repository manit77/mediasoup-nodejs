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
            let animationFrameId: number;

            const video = document.createElement("video");
            video.crossOrigin = "anonymous";
            video.muted = true;
            video.playsInline = true;
            video.srcObject = presenter.stream;
            video.width = 1;
            video.height = 1;
            //document.body.appendChild(video);


            const draw = () => {
                if (ctx && video && canvas.width > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
                    // Get the canvas's display size (CSS size in the UI)
                    const canvasRect = canvas.getBoundingClientRect();
                    const canvasDisplayWidth = canvasRect.width;
                    const canvasDisplayHeight = canvasRect.height;

                    // Get the device pixel ratio for high-DPI displays (e.g., Retina)
                    const dpr = window.devicePixelRatio || 1;

                    // Calculate the video's aspect ratio
                    const videoAspectRatio = video.videoWidth / video.videoHeight;
                    // Calculate the canvas's display aspect ratio
                    const canvasAspectRatio = canvasDisplayWidth / canvasDisplayHeight;

                    // Calculate dimensions to fit video in canvas (contain)
                    let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

                    // Set canvas pixel dimensions to match video resolution scaled by DPR
                    let canvasPixelWidth: number, canvasPixelHeight: number;
                    if (videoAspectRatio > canvasAspectRatio) {
                        // Video is wider: fit to width, letterbox height
                        canvasPixelWidth = video.videoWidth;
                        canvasPixelHeight = video.videoWidth / canvasAspectRatio;
                        drawWidth = canvasPixelWidth;
                        drawHeight = canvasPixelWidth / videoAspectRatio;
                        offsetX = 0;
                        offsetY = (canvasPixelHeight - drawHeight) / 2; // Center vertically
                    } else {
                        // Video is taller: fit to height, letterbox width
                        canvasPixelHeight = video.videoHeight;
                        canvasPixelWidth = video.videoHeight * canvasAspectRatio;
                        drawHeight = canvasPixelHeight;
                        drawWidth = canvasPixelHeight * videoAspectRatio;
                        offsetX = (canvasPixelWidth - drawWidth) / 2; // Center horizontally
                        offsetY = 0;
                    }

                    // Adjust canvas pixel dimensions for DPR to ensure crisp rendering
                    canvas.width = Math.round(canvasPixelWidth * dpr);
                    canvas.height = Math.round(canvasPixelHeight * dpr);

                    // Scale the drawing context to match DPR
                    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
                    ctx.scale(dpr, dpr);

                    // Clear the canvas
                    ctx.clearRect(0, 0, canvasPixelWidth, canvasPixelHeight);

                    // Draw the video centered with calculated dimensions
                    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
                }
                animationFrameId = requestAnimationFrame(draw);
            };

            const handleMetadataLoaded = () => {
                console.log(`Video metadata loaded. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
                // Ensure canvas CSS size is set (optional, if not set via CSS)
                canvas.style.width = canvas.style.width || "100%";
                canvas.style.height = canvas.style.height || "100%";
                draw();
            };

            const startDrawing = () => {
                if (!animationFrameId) {
                    draw();
                }
            };

            video.addEventListener("loadedmetadata", handleMetadataLoaded);
            video.addEventListener("canplay", startDrawing);
            video.addEventListener("loadeddata", startDrawing);

            video.play().catch((e) => console.error("Local video element for canvas failed to play:", e));

            // Handle window resize to update canvas size
            // const resizeObserver = new ResizeObserver(() => {
            //     draw();
            // });
            // resizeObserver.observe(canvas);

            return () => {
                cancelAnimationFrame(animationFrameId);
                video.removeEventListener("loadedmetadata", handleMetadataLoaded);
                video.removeEventListener("canplay", startDrawing);
                //resizeObserver.disconnect();
                video.pause();
                video.srcObject = null;
            };
        }
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
                    <canvas ref={canvasRef}
                        onClick={() => toggleFullscreen(canvasRef.current)}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
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