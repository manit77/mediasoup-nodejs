import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Form, Row, Col, Container, Card } from 'react-bootstrap';
import { useCall } from '../../hooks/useCall';
import { useNavigate, useParams } from 'react-router-dom';
import { useAPI } from '../../hooks/useAPI';
import { useUI } from '../../hooks/useUI';
import { ConferenceScheduledInfo, GetUserMediaConfig } from '@conf/conf-models';
import ThrottledButton from '../layout/ThrottledButton';
import { getBrowserUserMedia } from '@conf/conf-client';
import {
    CameraVideo, CameraVideoOff,
    Mic, MicMute,
    Gear, DoorOpen,
    ShieldLock, InfoCircle,
    ExclamationTriangle
} from 'react-bootstrap-icons';
import styles from './RoomLobby.module.css'; // Using the glass styles we created

interface RoomLobbyRouteParams {
    roomId: string;
    [key: string]: string | undefined; // Extension for type safety
}

const RoomLobby: React.FC = () => {
    
    return (
        <><h2 className="text-white">Room Lobby</h2></>        
    );
};

export default RoomLobby;