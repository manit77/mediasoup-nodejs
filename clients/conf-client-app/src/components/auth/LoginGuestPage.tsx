import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { generateRandomDisplayName, getQueryParams } from '../../utils/utils';
import { getConferenceConfig } from '../../services/ConferenceConfig';

const LoginGuestPage: React.FC = () => {

    const [allowEntry, setAllowEntry] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const api = useAPI();
    const ui = useUI();
    const navigate = useNavigate();
    let config = getConferenceConfig();
    const [participantGroupName, setParticipantGroupName] = useState("");
    const [participantGroup, setParticipantGroup] = useState("");
    const [conferenceGroup, setConferenceGroup] = useState("");
    const [title, setTitle] = useState("");

    const [configError, setConfigError] = useState("");

    useEffect(() => {
        console.log("getQueryParams", getQueryParams());
        let query = getQueryParams();
        let clientData: any = api.getClientData();
        let generateDisplayName = query.generateDisplayName;
        let title = query.title;

        let pgName = "";
        let pg = "";
        let confGroup = "";

        if (query.participantGroupName) {
            setParticipantGroupName(query.participantGroupName);
            pgName = query.participantGroupName;
        }

        if (query.participantGroup) {
            setParticipantGroup(query.participantGroup);
            pg = query.participantGroup;
        }

        if (query.conferenceGroup) {
            setConferenceGroup(query.conferenceGroup);
            confGroup = query.confGroup;
        }

        if (clientData?.participantGroupName) {
            setParticipantGroupName(clientData.participantGroupName);
            pgName = clientData.participantGroupName;
        }

        if (clientData?.participantGroup) {
            setParticipantGroup(clientData.participantGroup);
            pg = clientData.participantGroup;
        }

        if (clientData?.conferenceGroup) {
            setConferenceGroup(clientData.conferenceGroup);
            confGroup = clientData.conferenceGroup;
        }

        if (config.conf_require_participant_group && !pg) {
            //error
            setConfigError("Invalid login group.");
        }

        if (config.conf_require_participant_group_name && !pgName) {
            //error
            setConfigError("Invalid login group name.");
        }

        if (config.conf_require_conference_group && !confGroup) {
            setConfigError("Invalid conf group.");
        }
        
        if (generateDisplayName) {
            
            let displayName = generateRandomDisplayName();//generate a random display name
            setDisplayName(displayName);
            setAllowEntry(false);

        } else {
            if (query.displayName) {
                setDisplayName(query.displayName);
                setAllowEntry(false);
            }

            if (clientData?.displayName) {
                setDisplayName(clientData.displayName);
                setAllowEntry(false);
            }
        }

        if(title) {
            setTitle(title);
        } else {
            setTitle(participantGroupName);
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
            <h1>{title}</h1>
            <Card style={{ width: '400px', borderColor: '#007bff' }}>
                {
                    configError ? (
                        <Card.Body>
                            <Card.Title className="card-title-bg-orange text-center mb-4">{configError}</Card.Title>
                        </Card.Body>
                    )
                        :
                        (
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
                        )
                }
            </Card>
        </Container>
    );
};

export default LoginGuestPage;