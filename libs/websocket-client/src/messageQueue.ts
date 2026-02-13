/**
 * A generic asynchronous message queue that allows consumers to wait for messages
 * if the queue is empty. This implements a producer-consumer pattern where
 * messages can be pushed, and consumers can asynchronously wait for the next message.
 * @template T The type of messages to be stored in the queue.
 */
class MessageQueue<T> {
    /**
     * Stores messages when there are no active consumers (waiters).
     */
    private messages: T[] = [];
    /**
     * Stores the resolve functions of promises from consumers waiting for a message.
     */
    private waiters: ((value: T) => void)[] = [];

    /**
     * Pushes a new message into the queue. If there are consumers waiting for a message,
     * it immediately resolves the promise of the longest-waiting consumer. Otherwise,
     * the message is stored in the queue.
     * @param msg The message to push into the queue.
     */
    push(msg: T) {
        if (this.waiters.length > 0) {
            // If there's a waiter, don't queue the message.
            // Instead, get the oldest waiter's resolver and call it with the message.
            const resolve = this.waiters.shift()!;
            resolve(msg);
        } else {
            // If there are no waiters, queue the message for a future consumer.
            this.messages.push(msg);
        }
    }

    /**
     * Asynchronously waits for and retrieves the next message from the queue.
     * If a message is already available, it is returned immediately.
     * Otherwise, it waits until a new message is pushed or the timeout is reached.
     * @param timeoutMs The maximum time to wait for a message in milliseconds. Defaults to 30000.
     * @returns A promise that resolves with the next message in the queue.
     * @rejects An error if the timeout is reached before a message is received.
     */
    async next(timeoutMs: number = 30000): Promise<T> {
        if (this.messages.length > 0) {
            // If there are messages in the queue, return the oldest one (FIFO).
            return this.messages.shift()!;
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
            // No messages available, so we add a waiter.
            // The waiter is a function that will clear the timeout and resolve the promise.
            this.waiters.push((msg: T) => {
                clearTimeout(timer);
                resolve(msg);
            });
        });
    }
}