import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Button, Container, Dropdown } from 'react-bootstrap';
import { BoxArrowRight, GearFill, PersonPlusFill, DisplayFill, XSquareFill, CameraVideoFill, Easel, ThreeDotsVertical } from 'react-bootstrap-icons';
import { useCall } from '@client/hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '@client/hooks/useAPI';
import ConfirmPopUp from '@client/components/ui/ConfirmPopUp';
import styles from './CallTopMenu.module.css'; // Import the styles
import '@client/css/modal.css';
import '@client/css/buttons.css';

import InviteParticipantsModal from './InviteParticipantsModal';

interface CallTopMenuProps {
    onShowSettings: () => void;
}

const CallTopMenu: React.FC<CallTopMenuProps> = ({ onShowSettings }) => {
    const { presenter, conference, leaveCurrentConference, terminateCurrentConference, startScreenShare, stopScreenShare, isScreenSharing, localParticipant, startPresentingCamera, stopPresentingCamera } = useCall();
    const { isUser, getCurrentUser, isAdmin } = useAPI();
    const navigate = useNavigate();
    const [isPresenting, setIsPresenting] = useState(false);
    const [allowScreenShare, setAllowScreenShare] = useState(false);
    const [allowPresentation, setAllowPresentation] = useState(false);
    const [allowTerminateConf, setAllowTerminateConf] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

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
            <Navbar fixed="top" className={`${styles.glassNav} px-2 px-md-4 py-2 border-bottom border-secondary border-opacity-25`}>
                <Container fluid className="d-flex align-items-center justify-content-between px-0">

                    {/* Brand Section - Smaller font/margin on mobile */}
                    <div className="d-flex align-items-center">
                        <div className={styles.statusIndicator} title="Live" />
                        <Navbar.Brand className={`${styles.brandText} ms-2 ms-md-3 mb-0 fs-6 fs-md-5`}>
                            {conference.conferenceName}
                        </Navbar.Brand>
                    </div>

                    <Nav className="d-flex align-items-center gap-1 gap-md-2">
                        
                        {/* 1. Presentation Controls (Primary Action) */}
                        {allowPresentation && (
                            isPresenting ? (
                                <Button
                                    className={`menu-btn ${styles.pulseRed} text-white px-2 px-md-3`}
                                    onClick={handleStopPresenting}
                                >
                                    <Easel size={18} />
                                    <span className="d-none d-lg-inline ms-2">Stop</span>
                                </Button>
                            ) : (
                                <Dropdown align="end">
                                    <Dropdown.Toggle className={'menu-btn px-2 px-md-3'} variant="dark">
                                        <Easel size={18} />
                                        <span className="d-none d-lg-inline ms-2">Present</span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu variant="dark" className={styles.dropdownMenu}>
                                        <Dropdown.Item onClick={handleCameraPresenting}>
                                            <CameraVideoFill className="me-2" /> Camera
                                        </Dropdown.Item>
                                        {allowScreenShare && (
                                            <Dropdown.Item onClick={handleToggleScreenShare}>
                                                <DisplayFill className="me-2" /> Screen
                                            </Dropdown.Item>
                                        )}
                                    </Dropdown.Menu>
                                </Dropdown>
                            )
                        )}

                        {/* 2. Desktop-only Buttons (Hidden on Mobile) */}
                        <div className="d-none d-md-flex gap-2">                            
                            {isAdmin() && (
                                <Button className="menu-btn text-white border-0" onClick={() => setShowInviteModal(true)}>
                                    <PersonPlusFill size={18} />
                                    <span className="d-none d-lg-inline ms-2">Invite</span>
                                </Button>                                
                            )}
                            <Button variant="link" className="menu-btn text-white border-0" onClick={onShowSettings}>
                                <GearFill size={18} />
                            </Button>
                        </div>

                        {/* 3. Mobile "More" Menu (Visible only on Mobile) */}
                        <div className="d-block d-md-none">
                            <Dropdown align="end">
                                <Dropdown.Toggle variant="link" className="menu-btn text-white border-0 px-2">
                                    <ThreeDotsVertical size={20} />
                                </Dropdown.Toggle>
                                <Dropdown.Menu variant="dark">
                                    {isAdmin() && (
                                        <Dropdown.Item onClick={() => setShowInviteModal(true)}>
                                            <PersonPlusFill className="me-2" /> Invite
                                        </Dropdown.Item>
                                    )}
                                    <Dropdown.Item onClick={onShowSettings}>
                                        <GearFill className="me-2" /> Settings
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>

                        <div className="vr mx-1 mx-md-2 text-secondary opacity-25" style={{ height: '20px' }} />

                        {/* 4. Exit Actions - Aggressive text hiding on mobile */}
                        <div className="d-flex gap-1">
                            {allowTerminateConf && (
                                <Button
                                    className={`menu-btn ${styles.btnEndAll} px-2 px-md-3 fw-bold`}
                                    onClick={() => setShowConfirmModal(true)}
                                    title="End for All"
                                >
                                    <XSquareFill size={18} />
                                    <span className="d-none d-xl-inline ms-2">End for All</span>
                                </Button>
                            )}

                            <Button
                                className={`menu-btn ${styles.btnLeave} px-2 px-md-3`}
                                onClick={handleExitCall}
                                title="Leave"
                            >
                                <BoxArrowRight size={18} className={styles.leaveIcon} />
                                <span className="d-none d-xl-inline ms-2">Leave</span>
                            </Button>
                        </div>

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
            {showInviteModal && <InviteParticipantsModal show={showInviteModal} onClose={() => setShowInviteModal(false)} />}
        </>
    );
};

export default CallTopMenu;