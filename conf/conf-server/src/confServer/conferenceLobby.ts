import { Participant } from "../models/models.js";

export class ConferenceLobby {

    lobbies = new Map<string, Participant[]>();

    addParticipant(participant: Participant, conferenceExternalId: string) {
        let arr = this.lobbies.get(conferenceExternalId);
        if (!arr) {
            arr = [];
            this.lobbies.set(conferenceExternalId, arr);
        }

        if (!arr.some(p => p.participantId === participant.participantId)) {
            arr.push(participant);
        }
    }

    removeParticipant(participant: Participant, conferenceExternalId: string) {
        const arr = this.lobbies.get(conferenceExternalId);
        if (!arr) return;

        const idx = arr.findIndex(p => p.participantId === participant.participantId);
        if (idx > -1) arr.splice(idx, 1);

        if (arr.length === 0) {
            this.lobbies.delete(conferenceExternalId);
        }
    }

    getParticipants(conferenceExternalId: string): Participant[] {
        return this.lobbies.get(conferenceExternalId) ?? [];
    }

    countWaiting(conferenceExternalId: string) {
        let arr = this.lobbies.get(conferenceExternalId);
        if (!arr) {
            return 0;
        }
        return arr.length;
    }

    printStats() {
        for (const [id, participants] of this.lobbies) {
            console.log(`Lobby ${id}: ${participants.length} participants`);
        }
    }
}