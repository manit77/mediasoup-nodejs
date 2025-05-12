import { WebSocket } from "ws";

export class Participant {
    participantId: string = "";
    displayName: string = "";
    socket: WebSocket = null;
    conferenceRoom: ConferenceRoom = null;
}

export class ConferenceConfig {
    dateStart = new Date();
    dateEnd?: Date = null;
    maxParticipants: number = 2;
    allowConferenceVideo = true;
    allowConferenceAudio = true;

    allowParticipantVideo = true;
    allowParticpantAudio = true;

    inviteOnly = false; //anyone can join or by invite only
}

export class ConferenceRoom {
    externalId: number; //primary key from database
    conferenceRoomId: string; //conference server roomid generated
    participants: Participant[] = [];
    timerId?: NodeJS.Timeout = null;
    isClosed = false;
    leader?: Participant;

    // Track temporarily disconnected participants
    tempDisconnectedParticipants: Map<string, Participant> = new Map();

    // configs
    config: ConferenceConfig = new ConferenceConfig();

    onParticipantRemove: ((participant: Participant) => void);
    onParticipantAdd: (participant: Participant) => void;
    onClosed: () => void;

    startTimer(): boolean {

        let diffInMs = 0;
        if (this.config.dateStart && this.config.dateEnd) {
            diffInMs = this.config.dateEnd.getTime() - this.config.dateStart.getTime();
        }

        if (diffInMs > 0) {
            this.timerId = setTimeout(async () => {
                console.log("room timed out");
                this.close();
            }, diffInMs);
        }

        return true;
    }

    async addParticipant(participant: Participant): Promise<boolean> {
        if (this.isClosed) {
            console.error("conference is closed.");
            return false;
        }

        if (this.config.maxParticipants > 2 && this.participants.length >= this.config.maxParticipants) {
            console.error("max participants reached");
            return false;
        }

        if (participant.conferenceRoom) {
            console.error("already in conference room");
            return false;
        }

        //first participant is the leader
        if (this.participants.length == 0) {
            this.leader = participant;
        }

        console.log("addParticipant", participant.participantId);
        this.participants.push(participant);
        participant.conferenceRoom = this;

        if (this.onParticipantAdd) {
            this.onParticipantAdd(participant);
        }
        console.log("conf participants total: " + this.participants.length);

        return true;
    }

    removeParticipant(participant: Participant): void {
        console.log("removeParticipant ", participant.participantId);
        if (participant.conferenceRoom == this) {
            let idx = this.participants.findIndex(p => p.participantId == participant.participantId);
            if (idx > -1) {
                this.participants.splice(idx, 1);
            }
            participant.conferenceRoom = null;
        }

        if (this.onParticipantRemove) {
            this.onParticipantRemove(participant);
        }

        console.log("conf participants total: " + this.participants.length);

    }

    /**
     * Broadcasts a message to all active participants except the specified one
     * @param excludeParticipant Participant to exclude from broadcast
     * @param msg Message to broadcast
     */
    broadCastExcept(excludeParticipant: Participant, msg: any) {
        for (let p of this.participants) {
            if (p !== excludeParticipant && p.socket) {
                try {
                    p.socket.send(JSON.stringify(msg));
                } catch (error) {
                    console.error(`Failed to send message to participant ${p.participantId}`, error);
                }
            }
        }
    }

    getParticipantsExcept(except: Participant) {
        return this.participants.filter(p => p != except);
    }

    async broadCastAll(msg: any) {
        for (let p of this.participants.values()) {
            p.socket.send(JSON.stringify(msg));
        }
    }

    /**
     * Temporarily removes a participant (marks as disconnected but preserves slot)
     * @param participant The participant to temporarily remove
     */
    tempRemoveParticipant(participant: Participant) {
        // Store the participant for potential reconnection
        this.tempDisconnectedParticipants.set(participant.participantId, participant);
        
        // Remove from active participants array
        const index = this.participants.findIndex(p => p.participantId === participant.participantId);
        if (index !== -1) {
            this.participants.splice(index, 1);
        }
    }

    /**
     * Re-adds a participant after reconnection
     * @param participant The participant to add back to the conference
     * @returns true if successful, false otherwise
     */
    readdParticipant(participant: Participant): boolean {
        // Remove from temp disconnected map
        this.tempDisconnectedParticipants.delete(participant.participantId);
        
        // Add back to active participants
        this.participants.push(participant);
        
        // Execute the onParticipantAdd callback
        if (this.onParticipantAdd) {
            this.onParticipantAdd(participant);
        }
        
        return true;
    }

    close() {

        this.isClosed = true;

        if (this.timerId) {
            clearTimeout(this.timerId);
        }

        if (this.onClosed) {
            this.onClosed();
        }
    }
}