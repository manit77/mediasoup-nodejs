// test/mocks/mediasoupMock.ts
import { EventEmitter } from 'events';
// Minimal mock for mediasoup.types.Worker
export class MockWorker extends EventEmitter {
    constructor() {
        super(...arguments);
        this.pid = Math.floor(Math.random() * 10000); // Fake PID
        this.closed = false;
    }
    async createRouter(options) {
        // Mock router if needed
        return {
            id: 'mock-router',
            close: jest.fn(),
            createWebRtcTransport: jest.fn().mockResolvedValue({ id: 'mock-transport' }),
        };
    }
    close() {
        if (!this.closed) {
            this.closed = true;
            //this.emit('died');
        }
    }
}
