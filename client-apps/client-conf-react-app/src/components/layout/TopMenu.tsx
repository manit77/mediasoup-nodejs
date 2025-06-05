import React from 'react';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface TopMenuProps {
    onShowSettings: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onShowSettings }) => {
    const { currentUser, logout } = useAuth();
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
        <Navbar bg="light" expand="lg" className="border-bottom">
            <Container fluid>
                <Navbar.Brand href="#">VideoCon</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto">
                        {currentUser && (
                            <NavDropdown title={currentUser.displayName} id="user-nav-dropdown">
                                <NavDropdown.Item onClick={onShowSettings}>Settings</NavDropdown.Item>
                                <NavDropdown.Divider />
                                <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
                            </NavDropdown>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default TopMenu;