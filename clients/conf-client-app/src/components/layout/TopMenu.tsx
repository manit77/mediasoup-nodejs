import React, { useEffect, useState, useMemo } from 'react';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import { useAPI } from '../../hooks/useAPI';
import { useNavigate } from 'react-router-dom';
import { BoxArrowRight, CircleFill, Gear, Person, PersonGear } from 'react-bootstrap-icons';
import { objectToQueryString } from '../../utils/utils';
import { flushSync } from 'react-dom';
import { useCall } from '../../hooks/useCall';
import { getConferenceConfig } from '../../services/ConferenceConfig';
import { ConferenceClientConfig } from '@conf/conf-client';

interface TopMenuProps {
    onShowSettings: () => void;
}

const TopMenu: React.FC<TopMenuProps> = ({ onShowSettings }) => {
    const { getCurrentUser, logout, getClientData } = useAPI();
    const { disconnect, isConnected, isAuthenticated, isConnecting } = useCall();
    const navigate = useNavigate();
    const [config, setConfig] = useState<ConferenceClientConfig>(null);

    useEffect(() => {
        setConfig(getConferenceConfig());
    }, []);

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

        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const dynamicBackground = useMemo<React.CSSProperties>(() => {
        const dotSpacing = 12;
        const windAngle = -20;

        return {
            background: `
  /* Subtle grain noise */
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.12'/%3E%3C/svg%3E"),
  
  /* Sweeping highlight */
  linear-gradient(90deg, transparent 0%, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%, transparent 100%),
  
  /* Strong streaks */
  repeating-linear-gradient(
    ${windAngle}deg,
    rgba(255,255,255,0.12) 0px,
    rgba(255,255,255,0.12) 1px,
    transparent 1px,
    transparent 4px
  ),
  
  /* Micro streaks */
  repeating-linear-gradient(
    ${windAngle}deg,
    rgba(255,255,255,0.05) 0px,
    rgba(255,255,255,0.05) 0.5px,
    transparent 0.5px,
    transparent 2px
  ),
  
  /* Dots */
  radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1.5px),
  
  /* Base metal */
  linear-gradient(110deg, #0a0d12 0%, #161c24 30%, #101317 50%, #1e242c 70%, #0a0d12 100%)
`,
            backgroundSize: `
  100% 100%,      /* grain */
  200% 100%,      /* shine */
  100% 100%,      /* streaks */
  100% 100%,      /* micro */
  ${dotSpacing}px ${dotSpacing}px, /* dots */
  100% 100%       /* base */
`,
            backgroundBlendMode: 'overlay, overlay, overlay, overlay, overlay, normal',
        };
    }, []);


    return (
        <Navbar
            expand="lg"
            className="px-3 border-bottom border-secondary position-relative"
            style={dynamicBackground}
        >
            <Container fluid style={{ zIndex: 1 }}>
                <Navbar.Brand href="#" className="d-flex align-items-center fw-bold text-white">
                    <span style={{ letterSpacing: '1px', textTransform: 'uppercase', fontSize: '1rem' }}>
                        {config?.title || "System"}
                    </span>
                    <div
                        className="ms-3 d-flex align-items-center px-2 py-1 rounded"
                        style={{
                            fontSize: '0.65rem',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(4px)'
                        }}
                    >
                        <CircleFill
                            className={`me-2 ${isConnecting ? "text-warning" : isConnected && isAuthenticated ? 'text-success' : 'text-danger'}`}
                            size={7}
                        />
                        <span className="text-light opacity-75">
                            {isConnecting ? "SYNCING" : isConnected && isAuthenticated ? 'CONNECTED' : 'OFFLINE'}
                        </span>
                    </div>
                </Navbar.Brand>

                <Navbar.Toggle aria-controls="basic-navbar-nav" className="border-0 shadow-none" />

                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto d-flex align-items-center">

                        <div className="d-flex align-items-center px-3 py-1 me-3"
                            style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Person className="me-2 text-info opacity-75" size={14} />
                            <span className="text-white-50" style={{ fontSize: '0.85rem' }}>{getCurrentUser()?.displayName}</span>
                        </div>

                        <Nav.Link
                            className="text-white opacity-75 hover-bright d-flex align-items-center px-3 transition-all"
                            onClick={onShowSettings}
                            style={{ fontSize: '0.85rem' }}
                        >
                            <Gear className="me-2" size={16} />
                            Settings
                        </Nav.Link>

                        <Nav.Link
                            className="ms-lg-3 px-3 py-1 d-flex align-items-center logout-button transition-all"
                            onClick={handleLogout}
                            style={{
                                fontSize: '0.85rem',
                                color: 'rgba(255, 255, 255, 0.7)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.03)'
                            }}
                        >
                            <BoxArrowRight className="me-2" size={15} />
                            Logout
                        </Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
            <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)',
                backgroundSize: '200% 100%',
                animation: 'shine-sweep 8s ease-in-out infinite alternate',
                mixBlendMode: 'soft-light',
            }} />
        </Navbar>
    );
};

export default TopMenu;