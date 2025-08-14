import React from 'react';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import { useAPI } from '../../hooks/useAPI';
import { useNavigate } from 'react-router-dom';
import { BoxArrowRight, CircleFill, Gear, Person, PersonGear } from 'react-bootstrap-icons';
import { objectToQueryString } from '../../utils/utils';
import { flushSync } from 'react-dom';
import { useCall } from '../../hooks/useCall';

interface TopMenuProps {
    onShowSettings: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onShowSettings }) => {
    const { getCurrentUser, logout, getClientData } = useAPI();
    const { disconnect, isConnected, isAuthenticated, isConnecting } = useCall();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {

            let role = getCurrentUser()?.role;
            let path = "/login";
            
            if (role === "guest") {
                path = "/loginGuest";
            }

            let clientData = getClientData();
            console.log(`logout clientData:`, clientData);
            
            flushSync(() => {
                logout();
                disconnect();
            });

            navigate(path, { replace: true });

            // if (clientData) {                
            //     console.log(`navigate to`, path);
            //     navigate(path, { replace: true });
            // } else {
            //     navigate('/login', { replace: true });
            // }

        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <Navbar expand="lg" className="nav-bar border-bottom">
            <Container fluid>
                <Navbar.Brand href="#" className="d-flex align-items-center">
                    Video Conferencing Server
                    <CircleFill
                        className={`ms-2 ${isConnecting ? "text-warn" : isConnected && isAuthenticated ? 'text-success' : 'text-danger'}`}
                        size={12}
                        title={isConnecting ? "Connecting" : isConnected && isAuthenticated ? 'Connected & Authenticated' : 'Disconnected or Unauthenticated'}
                    />
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto">

                        <Nav.Item className="d-flex align-items-center text-white">
                            <Person className="me-1" size={16} />
                            {getCurrentUser()?.displayName}
                        </Nav.Item>


                        <Nav.Link className="text-white" onClick={onShowSettings}>
                            <Gear className="me-1" size={16} />
                            Settings
                        </Nav.Link>
                        <Nav.Link className="text-white" onClick={handleLogout}>
                            <BoxArrowRight className="me-1" size={16} />
                            Logout
                        </Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default TopMenu;