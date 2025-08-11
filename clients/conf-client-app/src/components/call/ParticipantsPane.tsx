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
    const { getCurrentUser } = useAPI();

    // const containerStyle: React.CSSProperties = horizontal
    //     ? {
    //         display: 'flex',
    //         flexDirection: 'row',
    //         flexWrap: 'wrap', // Enable wrapping based on available width
    //         gap: '8px',
    //         padding: '8px',
    //         background: '#2a2f34',
    //         width: '100%',
    //         boxSizing: 'border-box',
    //         justifyContent: 'center', // Align items to the start; change to 'center' if preferred
    //         overflowX: 'hidden', // Prevent horizontal scrolling; let wrapping handle it              

    //     }
    //     : {
    //         display: 'flex',
    //         flexDirection: 'column',
    //         gap: '8px',
    //         width: '100%',
    //     };

    // const cardStyle: React.CSSProperties = horizontal
    //     ? {
    //         // flex: '1 0 auto', // Allow growing but not shrinking below minWidth
    //         //width: '320px', // Minimum width before wrapping
    //         //height: '240px', // Keep fixed height for consistency
    //         justifyContent: 'center'
    //     }
    //     : {
    //         width: '100%',
    //         height: 'auto',
    //     };

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