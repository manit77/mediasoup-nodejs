import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';

const LoginPage: React.FC = () => {
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const auth = useAuth();
    const navigate = useNavigate();

    const handleSubmitAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!displayName.trim()) {
            setError('Display name is required.');
            return;
        }
        setLoading(true);
        try {
            await auth.login(displayName, password);
            navigate('/app'); // Navigate to authenticated area
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!displayName.trim()) {
            setError('Display name is required.');
            return;
        }
        setLoading(true);
        try {
            await auth.loginGuest(displayName);
            navigate('/app'); // Navigate to authenticated area
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
                        <Form.Group className="mb-3" controlId="displayName">
                            <Form.Label>Guest Display Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
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
            OR
            <Card style={{ width: '400px', borderColor: '#ff9800' }}>
                <Card.Body>
                    <Card.Title className="card-title-bg-orange text-center mb-4">Login as Admin</Card.Title>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmitAdmin}>
                        <Form.Group className="mb-3" controlId="displayName">
                            <Form.Label>Admin Display Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Enter your display name"
                                required
                                disabled={loading}
                            />
                            <Form.Control
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your passsword"
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

export default LoginPage;