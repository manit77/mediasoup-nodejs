import React, { useEffect, useState } from 'react';
import { useCall } from '@client/hooks/useCall';
import { GetUserMediaConfig, ParticipantInfo } from '@conf/conf-models';
import ThrottledButton from '../../ui/ThrottledButton';
import { useUI } from '@client/hooks/useUI';
import { useAPI } from '@client/hooks/useAPI';
import { ArrowRepeat, MicFill, CameraVideoFill, CircleFill, Circle, PersonCircle } from 'react-bootstrap-icons';
import { Button, ListGroup, Badge, Spinner } from 'react-bootstrap';

const ParticipantsOnlinePane: React.FC = () => {
    const ui = useUI()
    const {
        localParticipant,
        isAuthenticated,
        isConnected,
        sendInvite,
        isCallActive,
        inviteInfoSend,
        getLocalMedia, participantsOnline } = useCall();

    const api = useAPI();

    const [participantsToDisplay, setParticipantsToDisplay] = useState<ParticipantInfo[]>([]);

    // Handle initial loading state
    useEffect(() => {
        console.log(`isAuthenticated: ${isAuthenticated} isConnected: ${isConnected}`)

    }, [isAuthenticated, isConnected]);

    useEffect(() => {
        setParticipantsToDisplay(api.participantsOnline);
    }, [api.participantsOnline]);

    useEffect(() => {
        setParticipantsToDisplay(participantsOnline);
    }, [participantsOnline]);

    const handleRefreshParticipants = async () => {
        try {
            setParticipantsToDisplay(await api.fetchParticipantsOnline());
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

        let tracks = await getLocalMedia(getUserMediaConfig);
        if (tracks.length === 0) {
            console.log(`joining with no media`);
        }

        sendInvite(participant, getUserMediaConfig);
    };

    return (
        <div className="p-1">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="text-uppercase text-muted fw-bold small mb-0 tracking-wider">
                    Active Participants
                </h6>
                <Button
                    variant="ghost-primary" // Assuming a custom ghost style or just outline
                    size="sm"
                    className="rounded-circle border-0 text-primary"
                    onClick={handleRefreshParticipants}
                    disabled={!isConnected || !isAuthenticated}
                >
                    <ArrowRepeat className={!isConnected ? "animate-spin" : ""} />
                </Button>
            </div>

            {!isConnected || !isAuthenticated ? (
                <div className="text-center py-5 text-muted">
                    <Spinner size="sm" className="me-2" />
                    <small>Syncing directory...</small>
                </div>
            ) : participantsToDisplay.length === 0 ? (
                <div className="text-center py-5 bg-body-tertiary rounded border border-dashed">
                    <p className="text-muted mb-0">No contacts found.</p>
                </div>
            ) : (
                <ListGroup variant="flush" className="rounded border shadow-sm overflow-hidden">
                    {participantsToDisplay.map((participantInfo) => {
                        const isOnline = participantInfo.status === "online";
                        const isBusy = participantInfo.status === "busy";

                        return (
                            <ListGroup.Item
                                key={participantInfo.participantId}
                                className="d-flex justify-content-between align-items-center px-3 py-3 border-bottom bg-body"
                                style={{ transition: 'all 0.2s ease' }}
                            >
                                {/* Avatar & Name Section */}
                                <div className="d-flex align-items-center">
                                    <div className="position-relative me-3">
                                        <PersonCircle size={36} className="text-secondary opacity-50" />
                                        <div
                                            className={`position-absolute bottom-0 end-0 border border-2 border-white rounded-circle`}
                                            style={{
                                                width: '12px',
                                                height: '12px',
                                                backgroundColor: isOnline ? '#198754' : isBusy ? '#ffc107' : '#adb5bd'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <div className="fw-bold text-body">{participantInfo.displayName}</div>
                                        <div className="small text-muted text-capitalize">
                                            {participantInfo.status}
                                        </div>
                                    </div>
                                </div>

                                {/* Call Actions */}
                                <div className="d-flex align-items-center gap-2">
                                    <div className="btn-group bg-body-tertiary rounded-pill p-1 shadow-sm border">
                                        <ThrottledButton
                                            variant="link"
                                            className={`rounded-pill p-0 d-flex align-items-center justify-content-center ${isCallActive || !isOnline ? 'text-muted' : 'text-primary'}`}
                                            disabled={isCallActive || !!inviteInfoSend || !isOnline}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleContactClick(participantInfo, true, false);
                                            }}
                                            style={{ width: "40px", height: "40px" }}
                                        >
                                            <MicFill size={18} />
                                        </ThrottledButton> 

                                        <ThrottledButton
                                            variant="link"
                                            className={`rounded-pill p-0 d-flex align-items-center justify-content-center ${isCallActive || !isOnline ? 'text-muted' : 'text-success'}`}
                                            disabled={isCallActive || !!inviteInfoSend || !isOnline}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleContactClick(participantInfo, true, true);
                                            }}
                                            style={{ width: "40px", height: "40px" }}
                                        >
                                            <CameraVideoFill size={18} />
                                        </ThrottledButton>
                                    </div>

                                    {/* Status Badge (Reduced width for cleaner look) */}
                                    <Badge
                                        bg={isBusy ? "warning-subtle" : isOnline ? "success-subtle" : "light"}
                                        className={`ms-2 d-none d-md-inline-block border ${isBusy ? 'text-warning border-warning-subtle' : isOnline ? 'text-success border-success-subtle' : 'text-muted border-secondary-subtle'}`}
                                        style={{ minWidth: "80px", fontWeight: '600' }}
                                    >
                                        {isOnline ? 'Available' : isBusy ? 'Busy' : 'Away'}
                                    </Badge>
                                </div>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            )}
        </div>

    );
};

export default ParticipantsOnlinePane;