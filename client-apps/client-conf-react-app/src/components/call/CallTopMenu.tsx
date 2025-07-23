import React from 'react';
import { Navbar, Nav, Button, Container } from 'react-bootstrap';
import { BoxArrowRight, GearFill, ShareFill, PersonPlusFill, DisplayFill } from 'react-bootstrap-icons';
import { useCall } from '../../hooks/useCall';
import { useNavigate } from 'react-router-dom';

interface CallTopMenuProps {
    onShowSettings: () => void;
}

const CallTopMenu: React.FC<CallTopMenuProps> = ({ onShowSettings }) => {
    const { conferenceRoom, endCurrentCall, startScreenShare, stopScreenShare, isScreenSharing } = useCall();
    const navigate = useNavigate();

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

    return (
        <Navbar bg="dark" variant="dark" expand="lg" className="border-bottom border-secondary">
            <Container fluid>
                <Navbar.Brand href="#">{conferenceRoom.conferenceName}</Navbar.Brand>
                <Nav className="ms-auto d-flex flex-row align-items-center">
                    {/* <Button variant="outline-light" className="me-2" onClick={onShowInvite} title="Invite">
                        <PersonPlusFill size={20} /> <span className="d-none d-md-inline">Invite</span>
                    </Button> */}
                    <Button variant={isScreenSharing ? "info" : "outline-light"} className="me-2" onClick={handleToggleScreenShare} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                        <DisplayFill size={20} /> <span className="d-none d-md-inline">{isScreenSharing ? "Stop Sharing" : "Share"}</span>
                    </Button>
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