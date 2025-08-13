import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { getQueryParams } from '../../utils/utils';

const LoginGuestPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const api = useAPI();
    const ui = useUI();
    const navigate = useNavigate();

    useEffect(() => {
        console.log("getQueryParams:", getQueryParams());
    }, []);    

    const handleSubmitGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username.trim()) {
            setError('Display name is required.');
            return;
        }
        setLoading(true);
        try {
            let clientData = getQueryParams();
            let response = await api.loginGuest(username, clientData);
            if (response.error) {
                setError(response.error);
                ui.showToast(`Login failed. ${response.error}`, "error");
                return;
            }
            setError('');
            navigate('/app');
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
            <Card style={{ width: '400px', borderColor: '#007bff' }}>
                <Card.Body>
                    <Card.Title className="text-center mb-4">Login as Guest</Card.Title>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmitGuest}>
                        <Form.Group className="mb-3" controlId="username">
                            <Form.Label>Guest Display Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your display name"
                                required
                                disabled={loading}
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