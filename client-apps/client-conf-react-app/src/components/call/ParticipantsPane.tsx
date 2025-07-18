import React, { useEffect, useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAuth } from '../../hooks/useAuth';
import { MicFill, MicMuteFill, CameraVideoFill, CameraVideoOffFill } from 'react-bootstrap-icons';
import { Participant } from '@conf/conf-client';


interface ParticipantVideoPreviewProps {
    participant?: Participant
    onClick: () => void;
    isSelected?: boolean;
}

const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, onClick, isSelected }) => {
    const { callParticipants, localParticipant, getLocalMedia, toggleMuteAudio, toggleMuteVideo } = useCall();
    const { getCurrentUser } = useAuth();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [videoOff, setVideoOff] = useState(participant.isVideoOff);
    const [micOff, setMicOff] = useState(participant.isMuted);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        setIsAdmin(getCurrentUser()?.role === "admin");
    }, [getCurrentUser]);

    useEffect(() => {
        setVideoOff(participant.isVideoOff);
        setMicOff(participant.isMuted);
    }, [participant, callParticipants]);

    useEffect(() => {
        console.log(`participant updated, set video srcObject ${participant.displayName}`);
        if (participant.stream && videoRef.current) {
            videoRef.current.srcObject = participant.stream;
             console.log(`set srcObject ${participant.displayName}`);
        }
    }, [participant]);


    // no reliable across
    // Add mute/unmute event listeners for tracks
    // useEffect(() => {
    //     console.log(`bind track events`);
    //     if (!stream || !participant){
    //         console.log(`no stream or participant`);
    //         return;
    //     } 

    //     const audioTrack = stream.getAudioTracks()[0];
    //     const videoTrack = stream.getVideoTracks()[0];

    //     // Handle audio track mute/unmute
    //     const handleAudioMute = () => {
    //         console.log(`${displayName} audio track muted`);
    //         setMicOff(true);
    //         participant.isMuted = true;
    //     };
    //     const handleAudioUnmute = () => {
    //         console.log(`${displayName} audio track unmuted`);
    //         setMicOff(false);
    //         participant.isMuted = false;
    //     };

    //     // Handle video track mute/unmute
    //     const handleVideoMute = () => {
    //         console.log(`${displayName} video track muted`);
    //         setVideoOff(true);
    //         participant.isVideoOff = true;
    //     };
    //     const handleVideoUnmute = () => {
    //         console.log(`${displayName} video track unmuted`);
    //         setVideoOff(false);
    //         participant.isVideoOff = false;
    //     };


    //     // Attach listeners
    //     if (audioTrack) {
    //         audioTrack.addEventListener('mute', handleAudioMute);
    //         audioTrack.addEventListener('unmute', handleAudioUnmute);
    //     }
    //     if (videoTrack) {
    //         videoTrack.addEventListener('mute', handleVideoMute);
    //         videoTrack.addEventListener('unmute', handleVideoUnmute);
    //     }

    //     // Cleanup listeners
    //     return () => {
    //         if (audioTrack) {
    //             audioTrack.removeEventListener('mute', handleAudioMute);
    //             audioTrack.removeEventListener('unmute', handleAudioUnmute);
    //         }
    //         if (videoTrack) {
    //             videoTrack.removeEventListener('mute', handleVideoMute);
    //             videoTrack.removeEventListener('unmute', handleVideoUnmute);
    //         }
    //     };
    // }, [stream]);

    const onVideoClick = async () => {
        console.log("onVideoClick ", participant);

        if (localParticipant.participantId === participant.participantId) {
            if (participant.stream == null) {
                console.log("participant stream is null, get user media");
                await getLocalMedia();
                participant.stream = localParticipant.stream;
                participant.isVideoOff = participant.stream.getVideoTracks()[0]?.enabled ?? false;
                participant.isMuted = participant.stream.getAudioTracks()[0]?.enabled ?? false;

                setVideoOff(participant.isVideoOff);
                setMicOff(participant.isMuted);

                if (videoRef.current) {
                    videoRef.current.srcObject = participant.stream;
                }
                return;
            }
        }

        //toggle video track
        console.log(`toggle video track`);

        let track = participant.stream.getVideoTracks()[0];
        if (!track) {
            console.log(`no video track found.`);
            return;
        }
        console.log(`audio video enabled: ${track.enabled}`);

        let isVideoOff = participant.isVideoOff;
        console.log(`isVideoOff ${isVideoOff} change to ${!isVideoOff}`);
        participant.isVideoOff = !isVideoOff;
        setVideoOff(!isVideoOff);
        toggleMuteVideo(participant.participantId, !isVideoOff);
        console.log("participant.isMuted", participant.isMuted);

        console.log("micOff", participant.isMuted, "videoOff", participant.isVideoOff);
    }

    const onAudioClick = async () => {
        console.log("onAudioClick ", participant);

        if (localParticipant.participantId === participant.participantId) {
            console.log(`localParticipant`);
            if (participant.stream == null) {
                //get user media
                console.log(`getting localMedia`);
                await getLocalMedia();
                participant.stream = localParticipant.stream;
                participant.isVideoOff = !participant.stream.getVideoTracks()[0]?.enabled;
                participant.isMuted = !participant.stream.getAudioTracks()[0]?.enabled;
                setVideoOff(participant.isVideoOff);
                setMicOff(participant.isMuted);

                if (videoRef.current) {
                    videoRef.current.srcObject = participant.stream;
                }

                return;
            }
        }

        //toggle audio track
        console.log(`toggle audio track`);

        let track = participant.stream.getAudioTracks()[0];
        if (!track) {
            console.log(`no audio track found.`);
            return;
        }
        console.log(`audio track enabled: ${track.enabled}`);

        let isMuted = participant.isMuted;
        console.log(`isMuted ${isMuted} change to ${!isMuted}`);
        participant.isMuted = !isMuted;
        setMicOff(!isMuted);
        toggleMuteAudio(participant.participantId, !isMuted);
        console.log("participant.isMuted", participant.isMuted);
    }

    return (
        <Card className={`mb-2 participant-preview ${isSelected ? 'border-primary' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '75%' /* 4:3 Aspect Ratio */ }}>
                <video ref={videoRef} autoPlay playsInline muted={localParticipant.participantId === participant.participantId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#333' }} />
                {videoOff ? (
                    <div className="d-flex align-items-center justify-content-center" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#444' }}>
                        video is off
                        <CameraVideoOffFill size={30} />
                    </div>
                ) : null}
                <div className="position-absolute bottom-0 start-0 bg-dark bg-opacity-50 text-white px-2 py-1 w-100">
                    <small>{participant.displayName} {localParticipant.participantId === participant.participantId && "(You)"}</small>
                    <>
                        <span className="ms-1" onClick={() => onAudioClick()}>
                            {micOff ? <MicMuteFill color="red" /> : <MicFill color="lightgreen" />}
                        </span>
                        <span className="ms-1" onClick={() => onVideoClick()}>
                            {videoOff ? <CameraVideoOffFill color="red" /> : <CameraVideoFill color="lightgreen" />}
                        </span>
                    </>                    
                </div>
            </div>
        </Card>
    );
};

interface ParticipantsPaneProps {
    onSelectVideo: (userId: string, stream?: MediaStream) => void;
}

const ParticipantsPane: React.FC<ParticipantsPaneProps> = ({ onSelectVideo }) => {
    const { localParticipant, callParticipants } = useCall();
    const { getCurrentUser } = useAuth();

    useEffect(() => {
    }, [getCurrentUser])

    return (
        <div>
            <h5 className="mb-3">Participants ({callParticipants.size})</h5>
            {/* Local User Preview First */}
            {localParticipant && (
                <ParticipantVideoPreview
                    key={localParticipant.participantId}
                    participant={localParticipant}
                    onClick={() => onSelectVideo(localParticipant.participantId, localParticipant.stream)}
                    isSelected={callParticipants.size === 0}
                />
            )}

            {/* Remote Participants */}
            {[...callParticipants.values()]
                .filter(p => p.participantId !== localParticipant.participantId)
                .map((participant) => (
                    <ParticipantVideoPreview
                        key={participant.participantId}
                        participant={participant}
                        onClick={() => onSelectVideo(participant.participantId, participant.stream)}
                        isSelected={false}
                    />
                ))}
        </div>
    );
};

export default ParticipantsPane;