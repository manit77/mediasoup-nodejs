import React, { useEffect, useRef } from "react";

interface VideoPlayerProps {
    stream: MediaStream;
    muted?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, muted = false, className, style }) => {

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        // Only re-attach if it's a different stream
        if (videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;

            // Explicit play() to handle autoplay policy
            const playPromise = videoEl.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.warn("Video autoplay failed:", err);
                });
            }
        }

        // Watch for live tracks going away
        const checkTracks = () => {
            if (!stream.active || stream.getTracks().every(t => t.readyState === "ended")) {
                console.warn("Stream ended or all tracks stopped");
            }
        };
        stream.addEventListener("removetrack", checkTracks);
        stream.addEventListener("addtrack", checkTracks);

        return () => {
            stream.removeEventListener("removetrack", checkTracks);
            stream.removeEventListener("addtrack", checkTracks);

            // Cleanup on true unmount
            if (videoEl) {
                videoEl.srcObject = null;
            }
        };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={className}
            style={{
                background: "#000",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                ...style,
            }}
        />
    );
}

export default VideoPlayer;