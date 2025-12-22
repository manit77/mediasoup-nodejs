import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Badge, ListGroup } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../hooks/useUI';
import { GetUserMediaConfig, ParticipantInfo } from '@conf/conf-models';
import ThrottledButton from '../ui/ThrottledButton';
import { getConferenceConfig } from '../../services/ConferenceConfig';
import { TelephoneInboundFill, CameraVideoFill, MicFill, XCircleFill, PersonCircle, PersonPlus, PersonPlusFill } from 'react-bootstrap-icons';
import ParticipantsOnlinePane from '../layout/ParticipantsOnlinePane';
import { useAPI } from '../../hooks/useAPI';

const InviteParticipantsModal: React.FC<{ show: boolean, onClose: () => void }> = ({ show, onClose }) => {
    const { isCallActive, inviteInfoReceived, localParticipant, getMediaConstraints, callParticipants, sendInviteConf, conference } = useCall();
    const navigate = useNavigate();
    const ui = useUI();
    const audioRef = useRef<HTMLAudioElement>(null);
    const api = useAPI();

    const [inviteList, setInviteList] = useState<ParticipantInfo[]>([]);

    useEffect(() => {
        let fetchParticipants = async () => {
            try {
                await api.fetchParticipantsOnline();
            } catch (error) {
                console.error('Failed to fetch contacts:', error);
            }
        }
        fetchParticipants();
    }, []);

    useEffect(() => {

        callParticipants.forEach(participant => {
            let filtered = api.participantsOnline.filter(p => p.participantId !== participant.participantId);
            setInviteList(filtered);
        });

    }, [api.participantsOnline]);

    useEffect(() => {
        console.log("updated inviteInfoReceived", inviteInfoReceived);
    }, [inviteInfoReceived]);

    const sendInviteClick = async (participant: ParticipantInfo) => {

        let audioCall: boolean = true, videoCall: boolean = true;

        let getUserMediaConfig = new GetUserMediaConfig();
        getUserMediaConfig.isAudioEnabled = audioCall
        getUserMediaConfig.isVideoEnabled = videoCall;
        sendInviteConf(participant, getUserMediaConfig);
    };

    return (
        <>
            <audio ref={audioRef} src="/ring.wav" loop />

            <Modal show={show} centered backdrop="static" keyboard={false} onHide={onClose} size="lg">
                <Modal.Header closeButton className="bg-body">
                    <Modal.Title className="d-flex align-items-center text-secondary">
                        <PersonPlusFill className="me-2" />
                        <span>Invite Participants</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body >
                    {inviteList.length === 0 ? (
                        <div className="text-center my-4">
                            <XCircleFill size={48} className="text-muted mb-3" />
                            <h5 className="mb-2">No Participants Available</h5>
                        </div>
                    ) : (
                        <ListGroup variant="flush" className="rounded border shadow-sm overflow-hidden">
                            {inviteList.map((participantInfo) => {
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
                                                <ThrottledButton                                                    
                                                    className={`submit-btn ${isCallActive || !isOnline ? 'text-muted' : 'text-success'}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        sendInviteClick(participantInfo);
                                                    }}                                                    
                                                    >
                                                    <PersonPlus size={18} /> <span className='p-1'>Invite</span>
                                                </ThrottledButton>
                                        </div>
                                    </ListGroup.Item>
                                );
                            })}
                        </ListGroup>
                    )}
                </Modal.Body>
                <Modal.Footer className="bg-body border-top p-3">
                    <Button variant="primary" onClick={() => onClose()} className="submit-btn px-5 shadow-sm">
                        Ok
                    </Button>
                </Modal.Footer>
            </Modal>

        </>
    );
};

export default InviteParticipantsModal;