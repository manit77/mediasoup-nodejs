import { getConferenceClient } from '@client/services/ConferenceService';
import { GetUserMediaConfig } from '@conf-models/conferenceModels';
import { Device, SelectedDevices } from '@conf/conf-client';
import React, { createContext, useState, ReactNode, useEffect, useContext, useCallback, use } from 'react';

const conferenceClient = getConferenceClient();
const VIRTUAL_DEVICE_KEYWORDS = ['virtual', 'microsoft teams', 'zoom', 'obs', 'cable', 'mdaudio', 'fake', 'cisco', 'chromecast'];
const STORAGE_KEY = 'preferred_devices';

interface DeviceContextType {
    isCameraAvailable: boolean;
    isMicAvailable: boolean;
    availableDevices: { video: Device[]; audioIn: Device[]; audioOut: Device[] };
    getLocalMedia: (options: GetUserMediaConfig) => Promise<MediaStreamTrack[]>;
    getMediaConstraints: (getAudio: boolean, getVideo: boolean) => MediaStreamConstraints;
    selectedDevices: SelectedDevices;
    setSelectedDevices: React.Dispatch<React.SetStateAction<SelectedDevices>>;
}

export const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

const isVirtual = (label: string): boolean => VIRTUAL_DEVICE_KEYWORDS.some(keyword => label.toLowerCase().includes(keyword));

/** Prefer a real (non-virtual) device when choosing a default; fall back to virtual if no real device. */
function getPreferredDefaultDevice(devices: Device[]): Device | undefined {
    if (devices.length === 0) return undefined;
    const real = devices.filter(d => !isVirtual(d.label));
    const virtual = devices.filter(d => isVirtual(d.label));
    return real.length > 0 ? real[0] : virtual[0];
}

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isCameraAvailable, setCameraAvailable] = useState(false);
    const [isMicAvailable, setMicAvailable] = useState(false);
    const [availableDevices, setAvailableDevices] = useState<{ video: Device[]; audioIn: Device[]; audioOut: Device[] }>({ video: [], audioIn: [], audioOut: [] });

    // Initialize state from LocalStorage or the conferenceClient
    const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : conferenceClient.selectedDevices;
    });

    // Fetch devices and handle hardware changes
    useEffect(() => {
        const checkDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();

                // Log this to verify it's firing after wake
                console.log("Devices enumerated:", devices.length);

                const video = devices.filter(d => d.kind === 'videoinput').map(d => ({ id: d.deviceId, label: d.label || 'Camera' }));
                const audioIn = devices.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label || 'Mic' }));
                const audioOut = devices.filter(d => d.kind === 'audiooutput').map(d => ({ id: d.deviceId, label: d.label || 'Speaker' }));

                setAvailableDevices({ video, audioIn, audioOut });
                setCameraAvailable(video.length > 0);
                setMicAvailable(audioIn.length > 0);
            } catch (error) {
                console.error("Error enumerating devices:", error);
            }
        };

        // 1. Initial check
        checkDevices();

        // 2. Listen for hardware plug/unplug
        navigator.mediaDevices.addEventListener('devicechange', checkDevices);

        // 3. ELECTRON FIX: Listen for window focus/visibility
        // When the Mac unlocks, the Electron window receives focus.
        window.addEventListener('focus', checkDevices);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkDevices();
        });

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', checkDevices);
            window.removeEventListener('focus', checkDevices);
            // remove visibility listener as well
        };
    }, []);

    // Sync selected devices when available devices change (e.g. plug/unplug)
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
                    // If current device is missing or no selection, use preferred default (real over virtual)
                    const exists = devices.some(d => d.id === currentId);
                    if (!currentId || !exists) {
                        const defaultDevice = getPreferredDefaultDevice(devices);
                        if (defaultDevice) {
                            newSelection[idKey] = defaultDevice.id as any;
                            newSelection[labelKey] = defaultDevice.label as any;
                            changed = true;
                        }
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

    // Persist manual changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedDevices));
        conferenceClient.selectedDevices = selectedDevices;
    }, [selectedDevices]);

    const getMediaConstraints = (getAudio: boolean, getVideo: boolean): MediaStreamConstraints => {
        const constraints: { audio?: any, video?: any } = {};

        if (getAudio) {
            constraints.audio = selectedDevices.audioInId ? { deviceId: { exact: selectedDevices.audioInId } } : true;
        }
        if (getVideo) {
            constraints.video = selectedDevices.videoId ? { deviceId: { exact: selectedDevices.videoId, aspectRatio: 16 / 9, facingMode: "user" } } : true;
        }
        return constraints;
    };

    const getLocalMedia = async (options: GetUserMediaConfig) => {
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

        return tracks;

    };

    return (
        <DeviceContext.Provider value={{ isCameraAvailable, isMicAvailable, availableDevices, getLocalMedia, getMediaConstraints, selectedDevices, setSelectedDevices }}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => {
    const context = use(DeviceContext);
    if (!context) throw new Error('useDevice must be used within a DeviceProvider');
    return context;
};
