import React, { createContext, useState, ReactNode, useEffect, useCallback, useRef, useContext } from 'react';
import { ConferenceScheduledInfo, GetConferencesScheduledResultMsg, GetParticipantsResultMsg, LoggedOffMsg, ParticipantInfo } from '@conf/conf-models';
import { EventTypes } from '@conf/conf-client';
import { IMsg } from '@rooms/rooms-models';
import { useConfig } from '../hooks/useConfig';
import { getConferenceClient } from '../services/ConferenceService';
import { useAPI } from './APIContext';
import { useUI } from '@client/contexts/UIContext';

const conferenceClient = getConferenceClient();

interface PresenceContextType {
    /**
     * websocket is connecting
     */
    isConnecting: boolean;
    /**
     * websocket is connected
     */
    isConnected: boolean;
    /**
     * whether the connected socket is authenticated
     */
    isRegistered: boolean;

    isDisconnected: boolean;
    setIsDisconnected: React.Dispatch<React.SetStateAction<boolean>>;

    /**
     * list of all participants authenticated "contacts list"
     */
    participantsOnline: ParticipantInfo[];
    /**
     * list of all active conferences
     */
    conferencesOnline: ConferenceScheduledInfo[];

    getConferenceRoomsOnline: () => void;
    getParticipantsOnline: () => void;

    disconnect: () => void;
}

export const PresenceContext = createContext<PresenceContextType>(undefined);

export const PresenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const ui = useUI();
    const api = useAPI();
    const { config } = useConfig();

    const [isConnected, setIsConnected] = useState<boolean>(conferenceClient.isConnected());
    const [isConnecting, setIsConnecting] = useState<boolean>(conferenceClient.isConnecting());
    const [isRegistered, setIsRegistered] = useState<boolean>(conferenceClient.isRegistered());
    const [isDisconnected, setIsDisconnected] = useState<boolean>(false);

    const [participantsOnline, setParticipantsOnline] = useState<ParticipantInfo[]>(conferenceClient.participantsOnline);
    const [conferencesOnline, setConferencesOnline] = useState<ConferenceScheduledInfo[]>(conferenceClient.conferencesOnline);

    useEffect(() => {
        conferenceClient.init(config);
        initState();
    }, [config]);

    const initState = () => {
        setIsConnected(conferenceClient.isConnected());
        setIsConnecting(conferenceClient.isConnecting());
        setIsRegistered(conferenceClient.isRegistered());

        setParticipantsOnline(conferenceClient.participantsOnline);
        setConferencesOnline(conferenceClient.conferencesOnline);
    };

    const getParticipantsOnline = useCallback(() => {
        conferenceClient.getParticipantsOnline();
    }, []);

    const getConferenceRoomsOnline = useCallback(() => {
        conferenceClient.getConferenceRoomsOnline();
    }, []);

    // Ensure we only ever register a single PresenceContext listener with ConferenceClient
    const presenceEventHandlerRef = useRef<((eventType: string, msgIn: IMsg) => Promise<void> | void) | null>(null);

    const setupPresenceEvents = useCallback(() => {
        if (presenceEventHandlerRef.current) {
            return;
        }

        const onEvent = async (eventType: string, msgIn: IMsg) => {
            switch (eventType) {
                case EventTypes.registerResult: {
                    console.log("PresenceContext: registerResult", msgIn.data);

                    if (msgIn.error) {
                        console.log("PresenceContext: onRegisterFailed: error", msgIn.error);
                        setIsRegistered(false);
                        ui.showPopUp(`socket registration failed. ${msgIn.error}`, "error");
                        return;
                    }
                    getConferenceRoomsOnline();
                    setIsRegistered(true);
                    ui.hidePopUp();
                    break;
                }
                case EventTypes.loggedOff: {
                    console.log("PresenceContext: loggedOff");

                    initState();

                    let reason = (msgIn as LoggedOffMsg).data.reason ?? "you have logged off by the server";
                    ui.showPopUp(reason, "error", 0, () => {
                        console.warn("popup clicked");
                        api.logout();
                    });

                    conferenceClient.disconnect();
                    setIsConnected(false);

                    break;
                }
                case EventTypes.connected: {
                    console.log("PresenceContext: server connected");

                    initState();

                    ui.hidePopUp();
                    ui.showToast("connected to server");
                    break;
                }
                case EventTypes.disconnected: {
                    console.log("PresenceContext: disconnected from server");

                    initState();
                    ui.showToast("disconnected from server. trying to reconnect...");

                    break;
                }
                case EventTypes.participantsReceived: {
                    let msg = msgIn as GetParticipantsResultMsg;
                    console.log("PresenceContext: onContactsReceived", msg.data.participants);
                    setParticipantsOnline(msg.data.participants);
                    break;
                }
                case EventTypes.conferencesReceived: {
                    const msg = msgIn as GetConferencesScheduledResultMsg;
                    setConferencesOnline(msg.data.conferences);
                    break;
                }
            }
        };
        presenceEventHandlerRef.current = onEvent;
        conferenceClient.addEventListener(onEvent);

        return () => {
            // don't disconnect the conferenceClient
            // the PresenceContext can get recreated
        };
    }, [api, getConferenceRoomsOnline, ui, presenceEventHandlerRef]);

    useEffect(() => {
        setupPresenceEvents();
    }, [setupPresenceEvents]);

    const disconnect = useCallback(async () => {
        console.log("PresenceContext disconnect()");

        conferenceClient.disconnect();

        setIsConnected(false);
        setIsRegistered(false);
        setParticipantsOnline(conferenceClient.participantsOnline);
        setConferencesOnline(conferenceClient.conferencesOnline);
    }, []);

    return (
        <PresenceContext.Provider value={{
            isConnecting,
            isConnected,
            isRegistered,
            isDisconnected, setIsDisconnected,
            participantsOnline,
            conferencesOnline,
            getConferenceRoomsOnline,
            getParticipantsOnline,
            disconnect,
        }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = (): PresenceContextType => {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
};

