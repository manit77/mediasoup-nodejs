import React, {  } from 'react';
import { useCall } from '../../hooks/useCall';
import { useAPI } from '../../hooks/useAPI';
import { Participant } from '@conf/conf-client';
import { ParticipantVideoPreview } from './ParticipantVideoPreview';

interface ParticipantsPaneProps {
    onSelectVideo: (participant: Participant) => void;
    containerStyle?: React.CSSProperties;
    cardStyle?: React.CSSProperties;
}

const ParticipantsPane: React.FC<ParticipantsPaneProps> = ({ onSelectVideo, containerStyle, cardStyle }) => {
    const { localParticipant, callParticipants } = useCall();        

    return (
        <div style={containerStyle}>
            {/* Local User Preview First */}
            {localParticipant && (
                <ParticipantVideoPreview
                    key={localParticipant.participantId}
                    participant={localParticipant}
                    onClick={() => onSelectVideo(localParticipant)}
                    isSelected={callParticipants.size === 0}
                    style={cardStyle}
                />
            )}

            {/* Remote Participants */}
            {[...callParticipants.values()]
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