import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { getQueryParams } from '../../utils/utils';
import { getConferenceConfig } from '../../services/ConferenceConfig';

const LogoutPage: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const ui = useUI();
    const api = useAPI();
    const navigate = useNavigate();
    let config = getConferenceConfig();

    const [participantGroupName, setParticipantGroupName] = useState("");

    useEffect(() => {
        api.logout();
        api.clearClientData();
    }, []);    

    return (
        <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
            <h1>{participantGroupName}</h1>
            <Card style={{ width: '400px', borderColor: '#ff9800' }}>
                <Card.Body>
                    <Card.Title className="card-title-bg-orange text-center mb-4">Logout</Card.Title>
                    You have been logged out.
                </Card.Body>
            </Card>

        </Container>
    );
};

export default LogoutPage;