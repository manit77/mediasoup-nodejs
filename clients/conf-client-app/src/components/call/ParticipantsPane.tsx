import React, { } from 'react';
import { Participant } from '@conf/conf-client';
import { ParticipantVideoPreview } from './ParticipantVideoPreview';

interface ParticipantsPaneProps {
    localParticipant: Participant,
    participants: Participant[],
    onSelectVideo: (participant: Participant) => void;
    containerStyle?: React.CSSProperties;
    cardStyle?: React.CSSProperties;
    localParticipantStyle?: React.CSSProperties;
}

const ParticipantsPane: React.FC<ParticipantsPaneProps> = ({ localParticipant, participants, onSelectVideo, containerStyle, cardStyle, localParticipantStyle }) => {

    return (
        <div style={containerStyle}>
            {localParticipantStyle?.width }
            {[...participants.values()]
                .map((participant) => (
                    <ParticipantVideoPreview
                        key={participant.participantId}
                        participant={participant}
                        onClick={() => onSelectVideo(participant)}
                        isSelected={false}
                        style={localParticipant.participantId == participant.participantId ? localParticipantStyle : cardStyle}
                    />
                ))}
        </div>
    );
};

export default ParticipantsPane;