import dgram from 'dgram';
import * as fsync from 'fs';
import fs from 'fs/promises';
import chalk from 'chalk';

export function consoleError(...args: any) {
  console.error(chalk.red('[ERROR]', ...args));
}

export function consoleWarn(...args: any) {
  console.warn(chalk.yellow('[WARN]', ...args));
}

export function consoleInfo(...args: any) {
  console.warn(chalk.green(...args));
}

export function consoleLog(...args: any) {
  console.log(...args);
}

export function getFreeUDPPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const socket = dgram.createSocket('udp4');
      socket.bind(0, () => {
        const address = socket.address();
        socket.close();
        if (typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('Failed to get a free port'));
        }
      });
    }
    catch (err) {
      console.error(err);
      reject(err);
    }
  });
}

export function fileExists(src: string): boolean {
  return fsync.existsSync(src);
}

export async function readFile(src: string): Promise<string> {
  try {
    let buffer = (await fs.readFile(src));
    let content = await buffer.toString(); //bug, returns a promise of string
    return content;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function writeFile(src: string, content: string): Promise<void> {
  try {
    await fs.writeFile(src, content);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function appendFile(src: string, content: string): Promise<void> {
  try {
    await fs.appendFile(src, content);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export function hasKey(obj: any, key: any): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function stringIsNullOrEmpty(val: string): boolean {
  if (val === undefined || val == null || val == "") {
    return true;
  }
  return false;
}

export function checkKeysExist(obj: any, keys: string[]) {
  return keys.every(key => Object.prototype.hasOwnProperty.call(obj, key));
}