import dgram from 'dgram';
import * as fsync from 'fs';
import fs from 'fs/promises';
export function getFreeUDPPort() {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        socket.bind(0, () => {
            const address = socket.address();
            socket.close();
            if (typeof address === 'object') {
                resolve(address.port);
            }
            else {
                reject(new Error('Failed to get a free port'));
            }
        });
    });
}
export function fileExists(src) {
    return fsync.existsSync(src);
}
export async function readFile(src) {
    try {
        let buffer = (await fs.readFile(src));
        let content = await buffer.toString(); //bug, returns a promise of string
        return content;
    }
    catch (error) {
        console.log(error);
        throw error;
    }
}
export async function writeFile(src, content) {
    try {
        await fs.writeFile(src, content);
    }
    catch (error) {
        console.log(error);
        throw error;
    }
}
export async function appendFile(src, content) {
    try {
        await fs.appendFile(src, content);
    }
    catch (error) {
        console.log(error);
        throw error;
    }
}
export function hasKey(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
export function stringIsNullOrEmpty(val) {
    if (val === undefined || val == null || val == "") {
        return true;
    }
    return false;
}
export function checkKeysExist(obj, keys) {
    return keys.every(key => Object.prototype.hasOwnProperty.call(obj, key));
}
