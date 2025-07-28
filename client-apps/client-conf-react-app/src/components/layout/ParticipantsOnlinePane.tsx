import React, { useEffect } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { GetUserMediaConfig, ParticipantInfo } from '@conf/conf-models';
import { ArrowRepeat, CameraVideoFill, Circle, CircleFill, MicFill, Phone } from 'react-bootstrap-icons';

const ParticipantsOnlinePane: React.FC = () => {
    const {
        localParticipant,
        isAuthenticated,
        isConnected,
        participantsOnline,
        getParticipantsOnline,
        sendInvite,
        isCallActive,
        inviteInfoSend } = useCall();

    // Handle initial loading state
    useEffect(() => {
        console.warn(`isAuthenticated: ${isAuthenticated} isConnected: ${isConnected}`)

    }, [isAuthenticated, isConnected]);

    // Optional: Function to manually refresh contacts
    const handleRefreshParticipants = async () => {
        try {
            getParticipantsOnline();
        } catch (error) {
            console.error('Failed to refresh contacts:', error);
        }
    };

    const handleContactClick = async (participant: ParticipantInfo, audioCall: boolean, videoCall: boolean) => {

        //default to audio call
        localParticipant.tracksInfo.isAudioEnabled = audioCall;
        localParticipant.tracksInfo.isVideoEnabled = videoCall;

        let getUserMediaConfig = new GetUserMediaConfig();
        getUserMediaConfig.isAudioEnabled = localParticipant.tracksInfo.isAudioEnabled;
        getUserMediaConfig.isVideoEnabled = localParticipant.tracksInfo.isVideoEnabled;

        sendInvite(participant, getUserMediaConfig);
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5>Contacts</h5>
                <Button variant="outline-primary" size="sm" onClick={handleRefreshParticipants} disabled={!isConnected || !isAuthenticated}>
                    <ArrowRepeat />
                </Button>
            </div>
            {!isConnected || !isAuthenticated ? (
                <p>Loading contacts...</p>
            ) : participantsOnline.length === 0 ? (
                <p>No contacts found.</p>
            ) : (
                <ListGroup>
                    {participantsOnline.map((participantInfo) => (
                        <ListGroup.Item
                            key={participantInfo.participantId}
                            action
                            onClick={(event) => { event.preventDefault(); handleContactClick(participantInfo, true, false); }}
                            className="d-flex justify-content-between align-items-center"
                            disabled={isCallActive || !!inviteInfoSend}
                        >
                            {participantInfo.displayName}
                            <MicFill onClick={(event) => { event.stopPropagation(); event.preventDefault(); handleContactClick(participantInfo, true, false); }}></MicFill>
                            <CameraVideoFill onClick={(event) => {  event.stopPropagation();  event.preventDefault(); handleContactClick(participantInfo, true, true); }}></CameraVideoFill>

                            <Badge pill bg={participantInfo.participantId ? 'success' : 'secondary'} className="ms-2">
                                {participantInfo.participantId ? (
                                    <>
                                        <CircleFill /> Online
                                    </>
                                )
                                    : (
                                        <>
                                            <Circle /> Offline
                                        </>
                                    )}
                            </Badge>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </div>
    );
};

export default ParticipantsOnlinePane;