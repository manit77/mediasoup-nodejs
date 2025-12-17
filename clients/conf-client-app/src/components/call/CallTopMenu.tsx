import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Button, Container, Dropdown } from 'react-bootstrap';
import { BoxArrowRight, GearFill, ShareFill, PersonPlusFill, DisplayFill, XSquareFill, CameraVideoOffFill, CameraVideoFill, ProjectorFill, Easel } from 'react-bootstrap-icons';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import ConfirmPopUp from '../popups/ConfirmPopUp';
import styles from './CallTopMenu.module.css'; // Import the styles

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
            <Navbar fixed="top" className={`${styles.glassNav} px-4 py-2 border-bottom border-secondary border-opacity-25`}>
                <Container fluid className="d-flex align-items-center justify-content-between">

                    {/* Brand Section */}
                    <div className="d-flex align-items-center">
                        <div className={styles.statusIndicator} title="Live" />
                        <Navbar.Brand className={`${styles.brandText} ms-3 mb-0`}>
                            {conference.conferenceName}
                        </Navbar.Brand>
                    </div>

                    <Nav className="d-flex align-items-center gap-2">
                        {allowPresentation && (
                            isPresenting ? (
                                <Button
                                    className={`${styles.controlBtn} ${styles.pulseRed} text-white`}
                                    onClick={handleStopPresenting}
                                >
                                    <Easel size={18} className="me-2" />
                                    <span className="d-none d-md-inline">Stop Sharing</span>
                                </Button>
                            ) : (
                                <Dropdown align="end">
                                    <Dropdown.Toggle className={styles.controlBtn} variant="dark">
                                        <Easel size={18} className="me-2" />
                                        <span className="d-none d-md-inline">Present</span>
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

                        <Button variant="link" className={`${styles.controlBtn} text-white border-0`} onClick={onShowSettings}>
                            <GearFill size={18} />
                        </Button>

                        <div className="vr mx-2 text-secondary opacity-25" style={{ height: '20px' }} />

                        {/* End for All / Close Button - The Dramatic One */}
                        <Button
                            className={`${styles.controlBtn} ${styles.btnEndAll} px-4 fw-bold`}
                            onClick={() => setShowConfirmModal(true)}
                        >
                            <XSquareFill size={18} className="me-sm-2" />
                            <span className="d-none d-sm-inline">End for All</span>
                        </Button>

                        {/* Leave Button - The Subtle One */}
                        <Button
                            className={`${styles.controlBtn} ${styles.btnLeave} px-4`}
                            onClick={handleExitCall}
                        >
                            <BoxArrowRight size={18} className={`${styles.leaveIcon} me-sm-2`} />
                            <span className="d-none d-sm-inline">Leave</span>
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