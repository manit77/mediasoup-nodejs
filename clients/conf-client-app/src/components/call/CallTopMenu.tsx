import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Button, Container, Dropdown } from 'react-bootstrap';
import { BoxArrowRight, GearFill, ShareFill, PersonPlusFill, DisplayFill, XSquareFill, CameraVideoOffFill, CameraVideoFill, ProjectorFill, Easel } from 'react-bootstrap-icons';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import ConfirmPopUp from '../popups/ConfirmPopUp';

interface CallTopMenuProps {
    onShowSettings: () => void;
}

const CallTopMenu: React.FC<CallTopMenuProps> = ({ onShowSettings }) => {
    const { presenter, conference, leaveCurrentConference, terminateCurrentConference, startScreenShare, stopScreenShare, isScreenSharing, localParticipant, startPresentingCamera, stopPresentingCamera } = useCall();
    const { isUser, getCurrentUser } = useAPI();
    const navigate = useNavigate();
    const [isPresenting, setIsPresenting] = useState(false);
    const [allowScreenShare, setAllowScreenShare] = useState(false);
    const [allowPresentation, setAllowPresentation] = useState(false);
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

    const handleToggleScreenShare = async () => {
        if (isScreenSharing) {
            stopScreenShare();
            setIsPresenting(false);
        } else {
            if (await startScreenShare()) {
                setIsPresenting(true);
            } else {
                setIsPresenting(false);
            }
        }
    };

    const handleStopPresenting = () => {
        stopPresentingCamera();
        setIsPresenting(false);
    };


    const handleCameraPresenting = async () => {

        if (isPresenting) {
            stopPresentingCamera();
            setIsPresenting(false);
        } else {
            if (await startPresentingCamera()) {
                setIsPresenting(true);
            } else {
                setIsPresenting(false);
            }
        }
    };

    useEffect(() => {
        console.log(`CallTopMenu conference updated, `, conference);

        if (isUser()) {
            setAllowPresentation(true);
        } else {
            if (conference.conferenceConfig.guestsAllowScreenShare) {
                setAllowPresentation(true);
            } else {
                setAllowPresentation(false);
            }
        }
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

    useEffect(() => {
        console.log(`CallTopMenu presenter updated`, presenter);
        if (presenter && presenter.participantId == localParticipant.participantId) {
            setIsPresenting(true);
            return;
        }

        setIsPresenting(false);

    }, [presenter]);

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

                        {allowPresentation ?
                            (isPresenting ? <Button variant="danger" className="me-2" onClick={handleStopPresenting} title={isPresenting ? "Presenting" : "Not Presenting"}>
                                <Easel size={20} /> <span className="d-none d-md-inline">Stop Presenting</span>
                            </Button>
                                : <Dropdown align="end">
                                    <Dropdown.Toggle variant="outline-light" id="present-dropdown" className="me-2" title="Present">
                                        <Easel size={20} /> <span className="d-none d-md-inline">Present</span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu
                                        style={{
                                            position: "absolute",
                                            zIndex: 1050
                                        }}>
                                        <Dropdown.Item onClick={handleCameraPresenting}>
                                            <CameraVideoFill size={20} /> Camera
                                        </Dropdown.Item>
                                        {allowScreenShare ? (
                                            <Dropdown.Item onClick={handleToggleScreenShare}>
                                                <DisplayFill size={20} />
                                                <span>{isScreenSharing ? " Stop Screen" : " Screen"}</span>
                                            </Dropdown.Item>
                                        ) : null}
                                    </Dropdown.Menu>
                                </Dropdown>
                            )
                            : null
                        }
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