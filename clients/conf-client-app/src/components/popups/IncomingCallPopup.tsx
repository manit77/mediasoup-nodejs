import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Badge } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../hooks/useUI';
import { GetUserMediaConfig } from '@conf/conf-models';
import ThrottledButton from '../layout/ThrottledButton';
import { getConferenceConfig } from '../../services/ConferenceConfig';
import { TelephoneInboundFill, CameraVideoFill, MicFill, XCircleFill } from 'react-bootstrap-icons';


const IncomingCallPopup: React.FC = () => {
    const { isCallActive, inviteInfoReceived, acceptInvite, declineInvite, localParticipant, getMediaConstraints } = useCall();
    const navigate = useNavigate();
    const ui = useUI();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (isCallActive) {
            console.log("navigate to on-call");
            navigate('/on-call'); // Navigate to call screen
        }

    }, [isCallActive, navigate]);

    useEffect(() => {
        if (inviteInfoReceived) {
            let config = getConferenceConfig();
            if (config && config.debug_auto_answer) {
                handleAccept(true, true);
            }
        }

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
                console.warn("ring autoplay failed:", err);
            });
        }

    }, [inviteInfoReceived]);

    const handleAccept = async (isAudioEnabled: boolean, isVideoEnabled: boolean) => {

        if (!localParticipant.stream) {
            console.error(`stream is null`);
            ui.showPopUp("error: media stream not initialized");
            return;
        }

        localParticipant.tracksInfo.isAudioEnabled = isAudioEnabled;
        localParticipant.tracksInfo.isVideoEnabled = isVideoEnabled;

        let joinMediaConfig = new GetUserMediaConfig();
        joinMediaConfig.isAudioEnabled = localParticipant.tracksInfo.isAudioEnabled;
        joinMediaConfig.isVideoEnabled = localParticipant.tracksInfo.isVideoEnabled;
        console.warn("accepting invite with ", localParticipant.tracksInfo);

        joinMediaConfig.constraints = getMediaConstraints(joinMediaConfig.isAudioEnabled, joinMediaConfig.isVideoEnabled);

        await acceptInvite(joinMediaConfig);
    };

    const handleDecline = () => {
        declineInvite();
    };

    useEffect(() => {
        console.log("updated inviteInfoReceived", inviteInfoReceived);
    }, [inviteInfoReceived]);

    return (
        <>
            <audio ref={audioRef} src="/ring.wav" loop />

            <Modal show={true} centered backdrop="static" keyboard={false} contentClassName="border-0 shadow-lg">
                <Modal.Body className="p-0 overflow-hidden rounded">
                    {/* Animated Header Section */}
                    <div className="bg-primary text-white text-center p-5 position-relative">
                        {/* Pulsing Ring Effect */}
                        <div className="pulse-container mb-4">
                            <div className="pulse-ring"></div>
                            <div className="bg-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                                <TelephoneInboundFill size={40} className="text-primary animate-tada" />
                            </div>
                        </div>

                        <Badge bg="light" text="primary" className="text-uppercase px-3 py-2 mb-2 shadow-sm">
                            Incoming Call
                        </Badge>
                        <h3 className="fw-bold mb-0 mt-2">{inviteInfoReceived?.data.displayName || "Unknown Caller"}</h3>
                        <p className="opacity-75">is inviting you to join the session</p>
                    </div>

                    {/* Action Area */}
                    <div className="p-4 bg-body">
                        <div className="d-grid gap-3">
                            {/* Primary Action: Video */}
                            <Button
                                variant="success"
                                size="lg"
                                className="py-3 fw-bold d-flex align-items-center justify-content-center shadow-sm"
                                onClick={() => handleAccept(true, true)}
                            >
                                <CameraVideoFill className="me-2" size={20} /> Accept with Video
                            </Button>

                            {/* Secondary Action: Audio Only */}
                            <ThrottledButton
                                variant="outline-success"
                                size="lg"
                                className="py-2 d-flex align-items-center justify-content-center"
                                onClick={() => handleAccept(true, false)}
                            >
                                <MicFill className="me-2" size={18} /> Audio Only
                            </ThrottledButton>

                            <hr className="my-2" />

                            {/* Decline Action */}
                            <Button
                                variant="link"
                                className="text-danger text-decoration-none py-2"
                                onClick={handleDecline}
                            >
                                <XCircleFill className="me-1" /> Decline Call
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default IncomingCallPopup;