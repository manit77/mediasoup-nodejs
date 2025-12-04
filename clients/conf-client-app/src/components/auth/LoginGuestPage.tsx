import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { generateRandomDisplayName, getQueryParams } from '../../utils/utils';
import { getConferenceConfig } from '../../services/ConferenceConfig';
import { ClientConfig } from '@conf/conf-models';

const LoginGuestPage: React.FC = () => {

    const [allowEntry, setAllowEntry] = useState(true);
    const [requirePassword, setRequirePassword] = useState(false);
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const api = useAPI();
    const ui = useUI();
    const navigate = useNavigate();
    let config = getConferenceConfig();
    const [participantGroupName, setParticipantGroupName] = useState("");
    const [participantGroup, setParticipantGroup] = useState("");
    const [conferenceGroup, setConferenceGroup] = useState("");
    const [clientConfig, setClientConfig] = useState<ClientConfig>(null);
    const [title, setTitle] = useState("");
    const [configError, setConfigError] = useState("");
    const [postData, setPostData] = useState<any>(null);


    useEffect(() => {
        console.log("getQueryParams:", getQueryParams());
        let query = getQueryParams() ?? {};
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
                setTimeout(fetchConfig, 1000);
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
             * handle guest login
             */
            let generateDisplayName = resultMsg.data.config.guest_login_generate_username;

            if (resultMsg.data.config.guest_login_require_participant_group && !_participantGroup) {
                setConfigError("Invalid login group.");
            }

            if (resultMsg.data.config.guest_login_require_conference_group && !_conferenceGroup) {
                setConfigError("Invalid conference group.");
            }

            if (generateDisplayName) {
                let displayName = generateRandomDisplayName();//generate a random display name
                setUserName(displayName);
                setAllowEntry(false);

            } else {
                if (query.displayName) {
                    setUserName(query.displayName);
                    setAllowEntry(false);
                }

                if (clientData?.displayName) {
                    setUserName(clientData.displayName);
                    setAllowEntry(false);
                }
            }
            //

            setLoading(false);
        };

        fetchConfig();

    }, []);

    const handleSubmitGuest = async (e: React.FormEvent) => {
        e.preventDefault();

        setError("");
        if (!userName.trim()) {
            setError('Display name is required.');
            return;
        }

        setLoading(true);
        try {

            let _password = password;

            //client does not require a password
            if (!clientConfig.guest_login_require_password && !password) {
                _password = userName;
            }

            let clientData = getQueryParams();
            let response = await api.loginGuest(userName, _password, clientData);

            if (response?.user) {
                setError("");
                navigate('/app');
                return;
            }

            if (response?.error) {
                setError(`Login failed. ${response?.error}`);
                ui.showToast(`Login failed. Please try again.`, "error");
                return;
            }

            setError(`Login failed.`);
            ui.showToast(`Login failed. Please try again.`, "error");
            return;


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
                                        <Form.Label>Username</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            placeholder="Enter your user name"
                                            required
                                            disabled={loading || !allowEntry}
                                            style={{ background: !allowEntry ? "#c0c0c0" : "" }}
                                        />
                                    </Form.Group>
                                    {
                                        requirePassword ? (
                                            <Form.Group className="mb-3" controlId="password">
                                                <Form.Label>Password</Form.Label>
                                                <Form.Control
                                                    type="Password"
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Enter your password"
                                                    required
                                                    disabled={loading || !allowEntry}
                                                    style={{ background: !allowEntry ? "#c0c0c0" : "" }}
                                                />
                                            </Form.Group>
                                        ) : (null)
                                    }
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