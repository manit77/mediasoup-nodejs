import React, {  } from 'react';
import { Participant } from '@conf/conf-client';
import { ParticipantVideoPreview } from './ParticipantVideoPreview';

interface ParticipantsPaneProps {
    localParticipant: Participant,
    participants : Participant[],
    onSelectVideo: (participant: Participant) => void;
    containerStyle?: React.CSSProperties;
    cardStyle?: React.CSSProperties;
}

const ParticipantsPane: React.FC<ParticipantsPaneProps> = ({ localParticipant, participants, onSelectVideo, containerStyle, cardStyle }) => {

    return (
        <div style={containerStyle}>
            {/* Local User Preview First */}
            {localParticipant && (
                <ParticipantVideoPreview
                    key={localParticipant.participantId}
                    participant={localParticipant}
                    onClick={() => onSelectVideo(localParticipant)}
                    isSelected={participants.length === 0}
                    style={cardStyle}
                />
            )}

            {/* Remote Participants */}
            {[...participants.values()]
                .filter(p => p.participantId !== localParticipant.participantId)
                .map((participant) => (
                    <ParticipantVideoPreview
                        key={participant.participantId}
                        participant={participant}
                        onClick={() => onSelectVideo(participant)}
                        isSelected={false}
                        style={cardStyle}
                    />
                ))}
        </div>
    );
};

export default ParticipantsPane;