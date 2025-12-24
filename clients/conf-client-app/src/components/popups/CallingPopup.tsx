import React, { useEffect } from 'react';
import { Modal, Button, Spinner, Badge } from 'react-bootstrap';
import { useCall } from '@client/hooks/useCall';
import { CameraVideoFill, CameraVideoOffFill, MicFill, MicMuteFill, TelephoneOutboundFill, XCircleFill } from 'react-bootstrap-icons';

const CallingPopup: React.FC = () => {
    const { inviteInfoSend, cancelInvite } = useCall();

    useEffect(() => {
        console.log("updated inviteInfoSend", inviteInfoSend);
    }, [inviteInfoSend]);


    return (
        <Modal show={true} centered backdrop="static" keyboard={false} contentClassName="border-0 shadow-lg">
            <Modal.Body className="p-0 overflow-hidden rounded">
                {/* Connection Header Section */}
                <div className="bg-primary text-white text-center p-5 position-relative">
                    <div className="pulse-container mb-4">
                        <div className="pulse-ring-outbound"></div>
                        <div className="bg-white rounded-circle d-inline-flex align-items-center justify-content-center shadow" style={{ width: '80px', height: '80px' }}>
                            <TelephoneOutboundFill size={36} className="text-primary" />
                        </div>
                    </div>

                    <div className="d-flex align-items-center justify-content-center mb-2">
                        <Spinner animation="grow" size="sm" variant="light" className="me-2" />
                        <Badge bg="light" text="primary" className="text-uppercase px-3 py-1 shadow-sm">
                            Connecting...
                        </Badge>
                    </div>

                    <h3 className="fw-bold mb-1">{inviteInfoSend?.data.displayName || "Participant"}</h3>
                    <p className="opacity-75 small">calling...</p>
                </div>

                {/* Media Status Area */}
                <div className="p-4 bg-body text-center">
                    <div className="d-flex justify-content-center gap-4 mb-4">
                        {/* Audio Status */}
                        <div className="text-center">
                            <div className={`rounded-circle bg-body p-3 mb-2 border ${!inviteInfoSend?.data.withAudio ? 'border-danger-subtle' : ''}`}>
                                {inviteInfoSend?.data.withAudio ? (
                                    <MicFill className="text-success" size={20} />
                                ) : (
                                    <MicMuteFill className="text-danger" size={20} />
                                )}
                            </div>
                            <small className={inviteInfoSend?.data.withAudio ? "text-muted d-block" : "text-danger d-block fw-bold"}>
                                Audio {inviteInfoSend?.data.withAudio ? 'On' : 'Off'}
                            </small>
                        </div>

                        {/* Video Status */}
                        <div className="text-center">
                            <div className={`rounded-circle bg-body p-3 mb-2 border ${!inviteInfoSend?.data.withVideo ? 'border-danger-subtle' : ''}`}>
                                {inviteInfoSend?.data.withVideo ? (
                                    <CameraVideoFill className="text-success" size={20} />
                                ) : (
                                    <CameraVideoOffFill className="text-danger" size={20} />
                                )}
                            </div>
                            <small className={inviteInfoSend?.data.withVideo ? "text-muted d-block" : "text-danger d-block fw-bold"}>
                                Video {inviteInfoSend?.data.withVideo ? 'On' : 'Off'}
                            </small>
                        </div>
                    </div>

                    <div className="d-grid">
                        <Button
                            variant="danger"
                            size="lg"
                            className="py-2 fw-bold d-flex align-items-center justify-content-center shadow-sm"
                            onClick={cancelInvite}
                        >
                            <XCircleFill className="me-2" /> Cancel Call
                        </Button>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default CallingPopup;