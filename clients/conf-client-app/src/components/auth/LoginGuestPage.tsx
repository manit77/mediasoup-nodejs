import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { Form, Button, Container, Card, Alert, Spinner, Badge } from 'react-bootstrap';
import { generateRandomDisplayName, getQueryParams } from '../../utils/utils';
import { getConferenceConfig } from '../../services/ConferenceConfig';
import { ClientConfig } from '@conf/conf-models';
import { Person, KeyFill, DoorOpenFill, ExclamationOctagon } from 'react-bootstrap-icons';


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
        <Container className="d-flex flex-column align-items-center justify-content-center bg-body text-body" style={{ minHeight: '100vh' }}>
            <div className="text-center mb-4">
                <h1 className="fw-bold text-primary display-5">{participantGroupName}</h1>
            </div>

            <Card className="shadow-lg border-0" style={{ width: '400px', overflow: 'hidden' }}>
                {/* Blue Gradient Accent Bar for Guests */}
                <div style={{ height: '4px', background: 'linear-gradient(90deg, #007bff 0%, #00d4ff 100%)' }}></div>

                <Card.Body className="p-4">
                    {configError ? (
                        <div className="text-center py-3">
                            <ExclamationOctagon size={48} className="text-danger mb-3" />
                            <h5 className="text-danger">{configError}</h5>
                            <p className="small text-muted">Please contact the administrator.</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-4">
                                <div className="bg-primary-subtle d-inline-block p-3 rounded-circle mb-3">
                                    <DoorOpenFill size={32} className="text-primary" />
                                </div>
                                <Card.Title className="h4 fw-bold">Guest Login</Card.Title>
                            </div>

                            {error && (
                                <Alert variant="danger" className="py-2 small">
                                    {error}
                                </Alert>
                            )}

                            <Form onSubmit={handleSubmitGuest}>
                                <Form.Group className="mb-3" controlId="username">
                                    <Form.Label className="small fw-bold text-muted">Username</Form.Label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-transparent">
                                            <Person className="text-muted" />
                                        </span>
                                        <Form.Control
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            placeholder=""
                                            required
                                            disabled={loading || !allowEntry}
                                            className={!allowEntry ? "bg-body-secondary" : ""}
                                        />
                                    </div>
                                </Form.Group>

                                {requirePassword && (
                                    <Form.Group className="mb-4" controlId="password">
                                        <Form.Label className="small fw-bold text-muted">Room Password</Form.Label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-transparent">
                                                <KeyFill className="text-muted" />
                                            </span>
                                            <Form.Control
                                                type="password"
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter password"
                                                required
                                                disabled={loading || !allowEntry}
                                                className={!allowEntry ? "bg-body-secondary" : ""}
                                            />
                                        </div>
                                    </Form.Group>
                                )}

                                <Button
                                    variant={"primary"}
                                    type="submit"
                                    className="w-100 py-2 fw-bold shadow-sm mt-2"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <><Spinner animation="border" size="sm" className="me-2" /> Waiting...</>
                                    ) : <>Login</>}
                                </Button>
                            </Form>
                        </>
                    )}
                </Card.Body>

                {/* Footer for extra context */}
                <div className="bg-body-tertiary p-3 border-top text-center">
                    <small className="text-muted d-block mb-1">By joining, you agree to the room terms.</small>
                </div>
            </Card>
        </Container>
    );
};

export default LoginGuestPage;