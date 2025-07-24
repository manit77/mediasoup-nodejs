import React, { useEffect } from 'react';
import { ListGroup, Badge, Button } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { ParticipantInfo } from '@conf/conf-models';
import { ArrowRepeat, Circle, CircleFill } from 'react-bootstrap-icons';
import { useUI } from '../../hooks/useUI';

const ParticipantsOnlinePane: React.FC = () => {
    const ui = useUI();
    const {
        getLocalMedia,
        broadCastTrackInfo,
        localParticipant,
        isAuthenticated,
        isConnected, participantsOnline, getParticipantsOnline, sendInvite,
        isCallActive, inviteInfoSend, selectedDevices } = useCall();

    // Handle initial loading state
    useEffect(() => {
        console.log(`isAuthenticated: ${isAuthenticated} isConnected: ${isConnected}`)

    }, [isAuthenticated, isConnected]);

    // Optional: Function to manually refresh contacts
    const handleRefreshParticipants = async () => {
        try {
            getParticipantsOnline();
        } catch (error) {
            console.error('Failed to refresh contacts:', error);
        }
    };

    const handleContactClick = async (participant: ParticipantInfo) => {
                
        if (!localParticipant.stream) {
            console.error(`stream is null`);
            ui.showPopUp("error: media stream not initialized");
            return;
        }

        if (localParticipant?.stream.getTracks().length === 0) {
            console.warn(`media stream not initialized`);
            ui.showToast("media stream not initialized");
            let tracks = await getLocalMedia();
            if (tracks.length === 0) {
                ui.showPopUp("ERROR: could not start media devices.");
                return;
            }

            //up the tracks info for localPart 
            localParticipant.tracksInfo.isAudioEnabled = selectedDevices.isAudioEnabled;
            localParticipant.tracksInfo.isVideoEnabled = selectedDevices.isVideoEnabled;
        }

        if (!isCallActive && !inviteInfoSend) {
            sendInvite(participant, localParticipant.tracksInfo.isAudioEnabled, localParticipant.tracksInfo.isVideoEnabled);
        }
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
                            onClick={() => handleContactClick(participantInfo)}
                            className="d-flex justify-content-between align-items-center"
                            disabled={isCallActive || !!inviteInfoSend}
                        >
                            {participantInfo.displayName}
                            <Badge pill bg={participantInfo.participantId ? 'success' : 'secondary'} className="ms-2">
                                {participantInfo.participantId ? (
                                    <>
                                        <CircleFill /> Online
                                    </>
                                )
                                    : (
                                        <>
                                            <Circle /> 'Offline'
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