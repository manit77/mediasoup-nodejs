import { EventEmitter } from 'events';
import { vi } from 'vitest';

// Minimal mock for mediasoup.types.Worker using Vitest's mocking
export class MockWorker extends EventEmitter {
    pid: number = Math.floor(Math.random() * 10000); // Fake PID
    closed: boolean = false;

    /**
     * Mocks the createRouter method of a mediasoup Worker.
     * It returns a mock router object with a mocked createWebRtcTransport method.
     * @param options - Options passed to createRouter (mocked).
     * @returns A mocked router object.
     */
    async createRouter(options: any) {
        // Mock router if needed
        return {
            id: 'mock-router',
            // Use vi.fn() for mocking functions
            close: vi.fn(),
            // Use vi.fn().mockResolvedValue() for async functions that return a promise
            createWebRtcTransport: vi.fn().mockResolvedValue({ id: 'mock-transport' }),
        };
    }

    /**
     * Mocks the close method of the Worker.
     * Sets the 'closed' flag and optionally emits a 'died' event (commented out as per original).
     */
    close() {
        if (!this.closed) {
            this.closed = true;
            // If you need to simulate the 'died' event, uncomment the line below.
            // this.emit('died');
        }
    }
}
