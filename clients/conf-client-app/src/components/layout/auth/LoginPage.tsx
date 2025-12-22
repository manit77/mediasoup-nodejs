import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '@client/hooks/useAPI';
import { useUI } from '@client/hooks/useUI';
import { Form, Button, Container, Card, Alert, Spinner } from 'react-bootstrap';
import { PersonCircle, LockFill, ShieldLockFill, InfoCircle, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { getQueryParams } from '@client/utils/utils';
import { getConferenceConfig } from '@client/services/ConferenceConfig';
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
        
        let query = getQueryParams() ?? {};

        //reset login state if query params exist
        if (Object.keys(query).length > 0) {
            api.logout();
            api.clearClientData();
        }

        let clientData: any = api.getClientData() ?? {};

        let _participantGroup = "";
        let _participantGroupName = "";
        let _conferenceGroup = "";

        _participantGroup = query.participantGroup || clientData.participantGroup;
        setParticipantGroup(_participantGroup);

        _participantGroupName = query.participantGroupName || clientData.participantGroupName;
        setParticipantGroupName(_participantGroupName);

        _conferenceGroup = query.conferenceGroup || clientData.conferenceGroup;
        setConferenceGroup(_conferenceGroup);

        if (config.conf_require_participant_group && !_participantGroup) {
            setConfigError("participant group is required.");
            return;
        }

        let postData: any = {};
        postData.participantGroup = _participantGroup;
        postData.participantGroupName = _participantGroupName;
        postData.conferenceGroup = _conferenceGroup;

        postData = { ...postData, ...query };

        setPostData(postData);
        setLoading(true);

        let fetchConfig = async () => {
            let resultMsg = await api.fetchClientConfig(postData);

            console.warn(resultMsg);

            if (!resultMsg) {
                setConfigError("unable to get config");

                console.error("trying to fetchConfig again.");
                //try again
                setTimeout(fetchConfig, 3000);

                return;
            }

            setConfigError("");

            if (resultMsg.data.participantGroup) {
                _participantGroup = resultMsg.data.participantGroup;
                setParticipantGroup(_participantGroup);
            }

            if (resultMsg.data.participantGroupName) {
                _participantGroupName = resultMsg.data.participantGroupName;
                setParticipantGroupName(_participantGroupName);
            }

            if (resultMsg.data.conferenceGroup) {
                _conferenceGroup = resultMsg.data.conferenceGroup;
                setConferenceGroup(_conferenceGroup);
            }

            setClientConfig(resultMsg.data.config);

            /**
            * hand user login
            */

            if (resultMsg.data.config.user_login_require_participant_group && !_participantGroup) {
                setConfigError("Invalid login group.");
            }

            if (resultMsg.data.config.user_login_require_conference_group && !_conferenceGroup) {
                setConfigError("Invalid conference group.");
            }
            //

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
        <Container className="d-flex flex-column align-items-center justify-content-center bg-body text-body" style={{ minHeight: '100vh' }}>
            {/* Brand / Group Name */}
            <div className="text-center mb-4">
                <h1 className="fw-bold text-primary display-5">{participantGroupName}</h1>
                <p className="text-muted">Secure Conference Access</p>
            </div>

            <Card className="shadow-lg border-0" style={{ width: '400px', overflow: 'hidden' }}>
                {/* Decorative Top Bar (Replaces the solid orange header) */}
                <div style={{ height: '4px', background: 'linear-gradient(90deg, #ff9800 0%, #ff5722 100%)' }}></div>

                <Card.Body className="p-4">
                    {configError ? (
                        <Alert variant="warning" className="d-flex align-items-center">
                            <ExclamationTriangleFill className="me-2" />
                            <div>{configError}</div>
                        </Alert>
                    ) : (
                        <>
                            <div className="text-center mb-4">
                                <div className="bg-primary-subtle d-inline-block p-3 rounded-circle mb-3">
                                    <ShieldLockFill size={32} className="text-primary" />
                                </div>
                                <Card.Title className="h4 fw-bold">Admin Login</Card.Title>
                                <Card.Subtitle className="text-muted small">Enter your credentials to manage the room</Card.Subtitle>
                            </div>

                            {error && (
                                <Alert variant="danger" className="py-2 small d-flex align-items-center">
                                    <InfoCircle className="me-2" /> {error}
                                </Alert>
                            )}

                            <Form onSubmit={handleSubmitAdmin}>
                                <Form.Group className="mb-3" controlId="username">
                                    <Form.Label className="small fw-bold text-muted">Username</Form.Label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-transparent border-end-0">
                                            <PersonCircle className="text-muted" />
                                        </span>
                                        <Form.Control
                                            type="text"
                                            className="border-start-0 ps-0"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder=""
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </Form.Group>

                                <Form.Group className="mb-4" controlId="password">
                                    <Form.Label className="small fw-bold text-muted">Password</Form.Label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-transparent border-end-0">
                                            <LockFill className="text-muted" />
                                        </span>
                                        <Form.Control
                                            type="password"
                                            className="border-start-0 ps-0"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder=""
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </Form.Group>

                                <Button
                                    variant="primary"
                                    type="submit"
                                    className="w-100 py-2 fw-bold shadow-sm"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <><Spinner as="span" animation="border" size="sm" role="status" className="me-2" /> Logging in...</>
                                    ) : 'Sign In'}
                                </Button>
                            </Form>
                        </>
                    )}
                </Card.Body>

                {/* Footer Info */}
                <div className="bg-body p-2 border-top d-flex justify-content-between px-3" style={{ fontSize: '0.7rem' }}>
                    <span className="text-muted">v{config.version}</span>
                    <span className="text-muted">build: {config.commit?.substring(0, 7)}</span>
                </div>
            </Card>

            {/* Optional: Help link */}
            <p className="mt-4 text-muted small">
                {/* Need help? <a href="#" className="text-decoration-none text-primary">Contact Support</a> */}
            </p>
        </Container>
    );
};

export default LoginPage;