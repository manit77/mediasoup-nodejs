import { getConferenceClient } from '@client/services/ConferenceService';
import { GetUserMediaConfig } from '@conf-models/conferenceModels';
import { Device, SelectedDevices } from '@conf/conf-client';
import React, { createContext, useState, ReactNode, useEffect, useContext, useCallback } from 'react';

const conferenceClient = getConferenceClient();

interface DeviceContextType {
    isCameraAvailable: boolean;
    isMicAvailable: boolean;
    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    getLocalMedia: (options: GetUserMediaConfig) => Promise<MediaStreamTrack[]>;
    getMediaConstraints: (getAudio: boolean, getVideo: boolean) => MediaStreamConstraints;
    selectedDevices: SelectedDevices;
    setSelectedDevices: React.Dispatch<React.SetStateAction<SelectedDevices>>;
}

const STORAGE_KEY = 'preferred_devices';
export const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isCameraAvailable, setCameraAvailable] = useState(false);
    const [isMicAvailable, setMicAvailable] = useState(false);
    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });

    // Initialize state from LocalStorage or the conferenceClient
    const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : conferenceClient.selectedDevices;
    });

    // 1. Fetch devices and handle hardware changes
    const checkDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            const video = devices.filter(d => d.kind === 'videoinput').map(d => ({ id: d.deviceId, label: d.label || 'Camera' }));
            const audioIn = devices.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label || 'Mic' }));
            const audioOut = devices.filter(d => d.kind === 'audiooutput').map(d => ({ id: d.deviceId, label: d.label || 'Speaker' }));

            setAvailableDevices({ video, audioIn, audioOut });
            setCameraAvailable(video.length > 0);
            setMicAvailable(audioIn.length > 0);
        } catch (error) {
            console.error("Error enumerating devices:", error);
        }
    }, []);

    useEffect(() => {
        checkDevices();
        navigator.mediaDevices.addEventListener('devicechange', checkDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', checkDevices);
    }, [checkDevices]);

    // 2. Sync selected devices when available devices change (e.g. plug/unplug)
    useEffect(() => {
        setSelectedDevices(prev => {
            const newSelection = { ...prev };
            let changed = false;

            const syncType = (type: 'video' | 'audioIn' | 'audioOut', idKey: keyof SelectedDevices, labelKey: keyof SelectedDevices) => {
                const currentId = prev[idKey];
                const devices = availableDevices[type];

                if (devices.length === 0) {
                    // No devices of this type (e.g. unplugged) – clear selection
                    newSelection[idKey] = undefined;
                    newSelection[labelKey] = undefined;
                    changed = true;
                } else {
                    // If current device is missing from available list, fallback to first available
                    const exists = devices.some(d => d.id === currentId);
                    if (!currentId || !exists) {
                        newSelection[idKey] = devices[0].id as any;
                        newSelection[labelKey] = devices[0].label as any;
                        changed = true;
                    }
                }
            };

            syncType('video', 'videoId', 'videoLabel');
            syncType('audioIn', 'audioInId', 'audioInLabel');
            syncType('audioOut', 'audioOutId', 'audioOutLabel');

            if (changed) {
                return newSelection;
            }
            return prev;
        });
    }, [availableDevices]);

    // 3. Persist manual changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedDevices));
        conferenceClient.selectedDevices = selectedDevices;
    }, [selectedDevices]);

    const getMediaConstraints = useCallback((getAudio: boolean, getVideo: boolean): MediaStreamConstraints => {
        const constraints: { audio?: any, video?: any } = {};

        if (getAudio) {
            constraints.audio = selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true;
        }
        if (getVideo) {
            constraints.video = selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId, aspectRatio: 16 / 9, facingMode: "user" } } : true;
        }
        return constraints;
    }, [selectedDevices]);

    const getLocalMedia = useCallback(async (options: GetUserMediaConfig) => {
        console.log("getLocalMedia");

        if (!options.isAudioEnabled && !options.isVideoEnabled) {
            return [];
        }

        if (!options.constraints) {
            options.constraints = getMediaConstraints(options.isAudioEnabled, options.isVideoEnabled);
        }

        const tracks = await conferenceClient.getNewTracksForLocalParticipant(options);

        console.log('conferenceClient.localParticipant', conferenceClient.localParticipant.stream.getTracks());
        console.log('localParticipant', conferenceClient.localParticipant.stream.getTracks());

        const audioTrack = tracks.find(t => t.kind === "audio");
        if (audioTrack) {
            audioTrack.enabled = options.isAudioEnabled;
            console.log(`audioTrack:`, audioTrack.enabled);
        }

        const videoTrack = tracks.find(t => t.kind === "video");
        if (videoTrack) {
            videoTrack.enabled = options.isVideoEnabled;
            console.log(`videoTrack:`, videoTrack.enabled);
        }

        //setIsLocalStreamUpdated(true);
        console.log("setIsLocalStreamUpdated");

        return tracks;

    }, [getMediaConstraints]);

    return (
        <DeviceContext.Provider value={{ isCameraAvailable, isMicAvailable, availableDevices, getLocalMedia, getMediaConstraints, selectedDevices, setSelectedDevices }}>
            {children}
        </DeviceContext.Provider>
    );


};

export const useDevice = (): DeviceContextType => {
    const context = useContext(DeviceContext);
    if (context === undefined) {
        throw new Error('useDevice must be used within a DeviceProvider');
    }
    return context;
};
