import React, { useEffect, useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useAuth } from '../../hooks/useAuth';
import { MicFill, MicMuteFill, CameraVideoFill, CameraVideoOffFill } from 'react-bootstrap-icons';
import { CallParticipant } from '../../types';


interface ParticipantVideoPreviewProps {
    participant?: CallParticipant
    stream?: MediaStream;
    isMuted?: boolean;
    isVideoOff?: boolean;
    displayName: string;
    isLocal: boolean;
    onClick: () => void;
    isSelected?: boolean;
}

const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({ participant, stream, displayName, isLocal, onClick, isMuted, isVideoOff, isSelected }) => {
    const { getSetLocalStream } = useCall();
    const { currentUser } = useAuth();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [videoOff, setVideoOff] = useState(isVideoOff);
    const [micOff, setMicOff] = useState(isMuted);

    useEffect(() => {
        setVideoOff(isVideoOff);
        setMicOff(isMuted);
    }, [isMuted, isVideoOff]);

    useEffect(() => {
        console.log("set stream");
        if (participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    const onVideoClick = async () => {
        console.log("onVideoClick ", participant);
        const localParticipant = participant.id === currentUser?.id;

        if (localParticipant) {
            if (participant.stream == null) {
                //get user media
                participant.stream = await getSetLocalStream();
                participant.isVideoOff = !participant.stream.getVideoTracks()[0]?.enabled;
                participant.isMuted = !participant.stream.getAudioTracks()[0]?.enabled;

                setVideoOff(participant.isVideoOff);
                setMicOff(participant.isMuted);

            } else {
                //toggle
                if (participant.stream.getVideoTracks()[0]) {
                    participant.stream.getVideoTracks()[0].enabled = !participant.stream.getVideoTracks()[0]?.enabled;
                    participant.isVideoOff = !participant.stream.getVideoTracks()[0]?.enabled;
                    setVideoOff(participant.isVideoOff);                    
                }
            }
        } else {
            //remote user
        }
        
        console.log("micOff", participant.isMuted, "videoOff", participant.isVideoOff);
    }

    const onAudioClick = async () => {
        console.log("onVideoClick ", participant);
        const localParticipant = participant.id === currentUser?.id;

        if (localParticipant) {
            if (participant.stream == null) {
                //get user media
                participant.stream = await getSetLocalStream();
                participant.isVideoOff = !participant.stream.getVideoTracks()[0]?.enabled;
                participant.isMuted = !participant.stream.getAudioTracks()[0]?.enabled;
                setVideoOff(participant.isVideoOff);
                setMicOff(participant.isMuted);

            } else {
                //toggle               
                if (participant.stream.getAudioTracks()[0]) {
                    participant.stream.getAudioTracks()[0].enabled = !participant.stream.getAudioTracks()[0]?.enabled;
                    participant.isMuted = !participant.stream.getAudioTracks()[0]?.enabled;
                    setMicOff(participant.isMuted);
                }
            }
        } else {
            //remote user
        }
        
        console.log("micOff", participant.isMuted, "videoOff", participant.isVideoOff);
    }

    return (
        <Card className={`mb-2 participant-preview ${isSelected ? 'border-primary' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '75%' /* 4:3 Aspect Ratio */ }}>
                <video ref={videoRef} autoPlay playsInline muted={isLocal} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#333' }} />
                {videoOff ? (
                    <div className="d-flex align-items-center justify-content-center" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#444' }}>
                        video is off
                        <CameraVideoOffFill size={30} />
                    </div>
                ) : null}
                <div className="position-absolute bottom-0 start-0 bg-dark bg-opacity-50 text-white px-2 py-1 w-100">
                    <small>{displayName} {isLocal && "(You)"}</small>
                    <span className="ms-1"  onClick={() => onAudioClick()}>
                        {micOff ? <MicMuteFill color="red" /> : <MicFill color="lightgreen" />}
                    </span>
                    <span className="ms-1" onClick={() => onVideoClick()}>
                        {videoOff ? <CameraVideoOffFill color="red" /> : <CameraVideoFill color="lightgreen" />}
                    </span>
                </div>
            </div>
        </Card>
    );
};


interface ParticipantsPaneProps {
    onSelectVideo: (userId: string, stream?: MediaStream) => void;
    currentMainUserId: string | null;
}

const ParticipantsPane: React.FC<ParticipantsPaneProps> = ({ onSelectVideo, currentMainUserId }) => {
    const { participants, localStream } = useCall();
    const { currentUser } = useAuth();

    // Find local participant data from the participants list
    const localParticipant = participants.find(p => p.id === currentUser?.id);

    return (
        <div>
            <h5 className="mb-3">Participants ({participants.length})</h5>
            {/* Local User Preview First */}
            {currentUser && localParticipant && (
                <ParticipantVideoPreview
                    key={currentUser.id}
                    participant={localParticipant}
                    stream={localStream} // Always use the direct localStream from useCall for the local user's preview
                    displayName={currentUser.displayName}
                    isLocal={true}
                    isMuted={localParticipant.isMuted}
                    isVideoOff={localParticipant.isVideoOff}
                    onClick={() => onSelectVideo(currentUser.id, localStream)}
                    isSelected={currentMainUserId === currentUser.id || (currentMainUserId === 'local' && currentUser.id === localParticipant.id)}
                />
            )}

            {/* Remote Participants */}
            {participants
                .filter(p => p.id !== currentUser?.id) // Filter out local user
                .map((participant) => (
                    <ParticipantVideoPreview
                        key={participant.id}
                        participant={participant}
                        stream={participant.stream}
                        displayName={participant.displayName}
                        isLocal={false}
                        isMuted={participant.isMuted}
                        isVideoOff={participant.isVideoOff}
                        onClick={() => onSelectVideo(participant.id, participant.stream)}
                        isSelected={currentMainUserId === participant.id}
                    />
                ))}
        </div>
    );
};

export default ParticipantsPane;