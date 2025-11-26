import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { getQueryParams } from '../../utils/utils';
import { getConferenceConfig } from '../../services/ConferenceConfig';
import { ClientConfig } from '@conf/conf-models';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const api = useAPI();
    const ui = useUI();
    const navigate = useNavigate();
    let config = getConferenceConfig();

    const [configError, setConfigError] = useState("");

    const [participantGroupName, setParticipantGroupName] = useState("");
    const [participantGroup, setParticipantGroup] = useState("");
    const [conferenceGroup, setConferenceGroup] = useState("");
    const [clientConfig, setClientConfig] = useState<ClientConfig>(null);

    const [postData, setPostData] = useState<any>(null);


    useEffect(() => {
        console.log("getQueryParams:", getQueryParams());
        let query = getQueryParams();
        let clientData: any = api.getClientData();

        let pgName = "";
        let pg = "";
        let confGroup = "";

        if (query.participantGroup) {
            setParticipantGroup(query.participantGroup);
            pg = query.participantGroup;
        }

        if (query.participantGroupName) {
            setParticipantGroupName(query.participantGroupName);
            pgName = query.participantGroupName;
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
            setConfigError("participant group is required.");
            return;
        }

        let postData: any = {};
        postData.participantGroup = pg;
        postData.participantGroupName = pgName;
        postData.conferenceGroup = confGroup;

        postData = { ...postData, ...query };

        setPostData(postData);
        setLoading(true);


        let fetchConfig = async () => {
            let resultMsg = await api.fetchClientConfig(postData);

            console.warn(resultMsg);

            if (!resultMsg) {
                setConfigError("unable to get config");
                return;
            }

            if (resultMsg.data.participantGroup) {
                pg = resultMsg.data.participantGroup;
                setParticipantGroup(pg);
            }

            if (resultMsg.data.participantGroupName) {
                pgName = resultMsg.data.participantGroupName;
                setParticipantGroupName(pgName);
            }

            setClientConfig(resultMsg.data.config);

            if (resultMsg.data.config.user_login_require_participant_group && !pg) {
                setConfigError("Invalid login group.");
            }

            if (resultMsg.data.config.user_login_require_conference_group && !confGroup) {
                setConfigError("Invalid conference group.");
            }

            setLoading(false);
        };

       fetchConfig();


    }, []);

    const handleSubmitAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) {
            setError('Display name is required.');
            return;
        }
        setLoading(true);
        try {
            let response = await api.login(username, password, postData);
            if (response.error) {
                setError(response.error);
                ui.showToast(`Login failed. ${response.error}`, "error");
                return;
            }
            setError("");
            navigate('/app'); // Navigate to authenticated area
        } catch (err: any) {
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
            <h1>{participantGroupName}</h1>
            <Card style={{ width: '400px', borderColor: '#ff9800' }}>
                <Card.Body>
                    {configError && (<Card.Title className="card-title-bg-orange text-center mb-4">{configError}</Card.Title>)}
                    {!configError && (
                        <>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Card.Title className="card-title-bg-orange text-center mb-4">Login as Admin</Card.Title>
                            <Form onSubmit={handleSubmitAdmin}>
                                <Form.Group className="mb-3" controlId="username">
                                    <Form.Control
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        required
                                        disabled={loading}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="password">
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
                                <small>version: {config.version}</small> <small>commit: {config.commit}</small>
                            </Form>
                        </>
                    )}

                </Card.Body>

            </Card>

        </Container>
    );
};

export default LoginPage;