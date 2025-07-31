import dgram from 'dgram';
import * as fsync from 'fs';
import fs from 'fs/promises';
import chalk from 'chalk';
import pkg_lodash from 'lodash';
const { assign, pick, keys } = pkg_lodash;

export function consoleError(...args: any) {
  console.error(chalk.red('[ERROR]'), ...args);
}

export function consoleWarn(...args: any) {
  console.warn(chalk.yellow('[WARN]'), ...args);
}

export function consoleInfo(...args: any) {
  console.log(chalk.green('[INFO]'), ...args);
}

export function consoleLog(...args: any) {
  console.log(...args);
}

export function getFreeUDPPort(): Promise<number> {
  return new Promise((resolve, reject) => {
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

/**
 * copies fields from src to dst, no keys are deleted from the dst, no new keys are created in dst
 * @param src
 * @param dst 
 * @returns 
 */
export function fill(src: any, dst: any) {
  return assign(dst, pick(src, keys(dst)));
}
