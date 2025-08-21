import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { getQueryParams } from '../../utils/utils';

const LoginGuestPage: React.FC = () => {

    const [allowEntry, setAllowEntry] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const api = useAPI();
    const ui = useUI();
    const navigate = useNavigate();
    const [participantGroupName, setParticipantGroupName] = useState("");


    useEffect(() => {
        console.log("getQueryParams", getQueryParams());
        let query = getQueryParams();

        let clientData: any = api.getClientData();

        if (query.participantGroupName) {
            setParticipantGroupName(query.participantGroupName);
        }

        if (query.displayName) {
            setDisplayName(query.displayName);
            setAllowEntry(false);
        }

        if (clientData?.participantGroupName) {
            setParticipantGroupName(clientData.participantGroupName);
        }

        if (clientData?.displayName) {
            setDisplayName(clientData.displayName);
            setAllowEntry(false);
        }

    }, []);

    const handleSubmitGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!displayName.trim()) {
            setError('Display name is required.');
            return;
        }
        setLoading(true);
        try {
            let clientData = getQueryParams();
            let response = await api.loginGuest(displayName, clientData);
            if (response.error) {
                setError(response.error);
                ui.showToast(`Login failed. ${response.error}`, "error");
                return;
            }
            setError("");
            navigate('/app');
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
            <h1>{participantGroupName}</h1>
            <Card style={{ width: '400px', borderColor: '#007bff' }}>
                <Card.Body>
                    <Card.Title className="text-center mb-4">Login as Guest</Card.Title>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmitGuest}>
                        <Form.Group className="mb-3" controlId="username">
                            <Form.Label>Guest Display Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Enter your display name"
                                required
                                disabled={loading || !allowEntry}
                                style={{ background: !allowEntry ? "#c0c0c0" : "" }}
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default LoginGuestPage;