import React from 'react';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import { useAPI } from '../../hooks/useAPI';
import { useNavigate } from 'react-router-dom';
import { BoxArrowRight, Gear, Person, PersonGear } from 'react-bootstrap-icons';

interface TopMenuProps {
    onShowSettings: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onShowSettings }) => {
    const { getCurrentUser, logout } = useAPI();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Logout failed", error);
            // Handle logout error display if necessary
        }
    };

    return (
        <Navbar expand="lg" className="nav-bar border-bottom">
            <Container fluid>
                <Navbar.Brand href="#">Video Conferencing Server</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto">
                        <Nav.Link disabled>
                            <Person className="me-1" size={16} />
                            {getCurrentUser()?.displayName}
                        </Nav.Link>
                        <Nav.Link onClick={onShowSettings}>
                            <Gear className="me-1" size={16} />
                            Settings
                        </Nav.Link>
                        <Nav.Link onClick={handleLogout}>
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