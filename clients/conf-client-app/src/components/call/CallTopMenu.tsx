import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Button, Container } from 'react-bootstrap';
import { BoxArrowRight, GearFill, ShareFill, PersonPlusFill, DisplayFill } from 'react-bootstrap-icons';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';

interface CallTopMenuProps {
    onShowSettings: () => void;
}

const CallTopMenu: React.FC<CallTopMenuProps> = ({ onShowSettings }) => {
    const { conference, endCurrentCall, startScreenShare, stopScreenShare, isScreenSharing } = useCall();
    const { isUser, getCurrentUser } = useAPI();
    const navigate = useNavigate();
    const [allowScreenShare, setAllowScreenShare] = useState(true);

    const handleExitCall = () => {
        endCurrentCall();
        navigate('/app'); // Navigate after ending call
    };

    const handleToggleScreenShare = () => {
        if (isScreenSharing) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    };

    useEffect(() => {

        //check if screen share is present on the browser
        if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
            console.warn(`screen share not available on this device.`);
            setAllowScreenShare(false);
            return;
        }

        if (isUser()) {
            setAllowScreenShare(true);
        } else {
            if (conference.conferenceConfig.guestsAllowScreenShare) {
                setAllowScreenShare(true);
            } else {
                setAllowScreenShare(false);
            }
        }

    }, [conference, isUser])

    return (
        <Navbar bg="dark" variant="dark" expand="lg" className="border-bottom border-secondary call-top-menu">
            <Container fluid>
                <Navbar.Brand href="#" className="d-flex align-items-center text-truncate"
                    style={{                        
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                    }}>{conference.conferenceName}</Navbar.Brand>
                <Nav className="ms-auto d-flex flex-row align-items-center">
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
                    <Button variant="danger" onClick={handleExitCall} title="Exit Call">
                        <BoxArrowRight size={20} /> <span className="d-none d-md-inline">Exit</span>
                    </Button>
                </Nav>
            </Container>
        </Navbar>
    );
};

export default CallTopMenu;