import { RoomLog } from "@rooms/rooms-models";
import { RoomLogAdapter } from "./room.js";

export class RoomLogAdapterInMemory implements RoomLogAdapter {
    logs: RoomLog[] = [];

    async save(log: RoomLog) {
        this.logs.push(log);
    }

    async get(roomId: string): Promise<RoomLog[]> {
        return this.logs.filter(i => i.RoomId === roomId);
    }

}