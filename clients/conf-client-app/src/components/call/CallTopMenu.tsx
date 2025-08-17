import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Button, Container } from 'react-bootstrap';
import { BoxArrowRight, GearFill, ShareFill, PersonPlusFill, DisplayFill, XSquareFill } from 'react-bootstrap-icons';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import ConfirmPopUp from '../popups/ConfirmPopUp';

interface CallTopMenuProps {
    onShowSettings: () => void;
}

const CallTopMenu: React.FC<CallTopMenuProps> = ({ onShowSettings }) => {
    const { conference, leaveCurrentConference, terminateCurrentConference, startScreenShare, stopScreenShare, isScreenSharing, localParticipant } = useCall();
    const { isUser, getCurrentUser } = useAPI();
    const navigate = useNavigate();
    const [allowScreenShare, setAllowScreenShare] = useState(true);
    const [allowTerminateConf, setAllowTerminateConf] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const handleOpenModal = () => setShowConfirmModal(true);
    const handleCloseModal = () => setShowConfirmModal(false);
    const handleConfirmAction = () => {
        handleTerminateConference();
        handleCloseModal();
    };

    const handleExitCall = () => {
        leaveCurrentConference();
        navigate('/app');
    };

    const handleTerminateConference = () => {
        terminateCurrentConference();
        navigate('/app');
    };

    const handleToggleScreenShare = () => {
        if (isScreenSharing) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    };

    useEffect(() => {
        console.log(`CallTopMenu conference updated, `, conference);

        //check if screen share is present on the browser
        if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
            console.log(`screen share not available on this device.`);
            setAllowScreenShare(false);
        } else {
            if (isUser()) {
                setAllowScreenShare(true);
            } else {
                if (conference.conferenceConfig.guestsAllowScreenShare) {
                    setAllowScreenShare(true);
                } else {
                    setAllowScreenShare(false);
                }
            }
        }

        if (conference.leaderId && conference.leaderId === localParticipant.participantId) {
            console.log(`CallTopMenu setAllowTerminateConf true`);
            setAllowTerminateConf(true);
        } else {
            console.log(`CallTopMenu setAllowTerminateConf false`);
        }

    }, [conference, isUser])

    return (
        <>
            <Navbar bg="dark" variant="dark" expand="lg" className="border-bottom border-secondary call-top-menu">
                <Container fluid>
                    <Navbar.Brand href="#" className="d-flex align-items-center text-truncate"
                        style={{
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        }}>{conference.conferenceName}</Navbar.Brand>

                    <Nav className="ms-auto d-flex flex-row align-items-center" style={{ justifyContent: 'space-between', width: 'auto', gap: '10px' }}>
                        {/* <Button variant="outline-light" className="me-2" onClick={onShowInvite} title="Invite">
                        <PersonPlusFill size={20} /> <span className="d-none d-md-inline">Invite</span>
                    </Button> */}

                        {allowScreenShare ? (
                            <Button variant={isScreenSharing ? "info" : "outline-light"} className="me-2" onClick={handleToggleScreenShare} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                                <DisplayFill size={20} /> <span className="d-none d-md-inline">{isScreenSharing ? "Stop Sharing" : "Share"}</span>
                            </Button>
                        ) : null}

                        <Button variant="outline-light" className="me-2" onClick={onShowSettings} title="Settings">
                            <GearFill size={20} /> <span className="d-none d-md-inline">Settings</span>
                        </Button>

                        {allowTerminateConf ? (<Button variant="danger" onClick={handleOpenModal} title="Terminate">
                            <XSquareFill size={20} /> <span className="d-none d-md-inline">End for All</span>
                        </Button>) : null}

                        <Button variant="danger" onClick={handleExitCall} title="Exit Call">
                            <BoxArrowRight size={20} /> <span className="d-none d-md-inline">Leave</span>
                        </Button>

                    </Nav>
                </Container>
            </Navbar>
            <ConfirmPopUp
                show={showConfirmModal}
                onHide={handleCloseModal}
                onConfirm={handleConfirmAction}
                title="End Conference"
                message="Are you sure you want to end the conference for all participants?"
            />
        </>
    );
};

export default CallTopMenu;