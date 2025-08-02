import dgram from 'dgram';
import * as fsync from 'fs';
import fs from 'fs/promises';
import chalk from 'chalk';
import pkg_lodash from 'lodash';
const { assign, pick, keys, clone, isString, isDate, isObject, isArray } = pkg_lodash;

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

export function isNullOrUndefined(val: any): boolean {
  if (undefined === val || val == null) {
    return true;
  }
  return false;
}

export function parseString(invalue: any, defaultvalue: string = ""): string {
  if (typeof invalue === "string") {
    return invalue;
  } else if ((typeof invalue === "number" && !isNaN(invalue) && isFinite(invalue)) || typeof invalue === "boolean" || isDate(invalue)) {
    return String(invalue);
  }
  return defaultvalue;
}

export function parseBool(invalue: any, defaultvalue = false): boolean {
  if (invalue === true || (typeof invalue === "number" && invalue > 0) || invalue === "1" || invalue === "y" || invalue === "Y") {
    return true;
  } else if (invalue === false || (typeof invalue === "number" && invalue < 1) || invalue === "0" || invalue === "n" || invalue === "N") {
    return false;
  }
  return defaultvalue;
}

export function parseNum(invalue: any, defaultvalue = 0): number {
  var rv = 0;
  if (invalue == null || invalue == typeof (undefined)) {
    rv = defaultvalue
  } else {
    if (isNaN(invalue) || !isFinite(invalue)) {
      rv = defaultvalue;
    }
    else {
      rv = Number(invalue);
    }
  }
  return rv;
}

export function parseDate(invalue: any, defaultvalue: Date = null): Date | null {
  var rv = null;
  if (invalue == null || invalue == typeof (undefined) || invalue === "") {
    rv = defaultvalue
  } else if (isDate(invalue)) {
    rv = invalue;
  } else {
    if (isString(invalue)) {
      rv = new Date(invalue);
    } else {
      rv = defaultvalue;
    }
  }
  return rv;
}

export function parse(src: any, refvalue: any): any {
  if (typeof refvalue === "string") {
    return parseString(src);
  } else if (typeof refvalue === "number") {
    return parseNum(src);
  } else if (typeof refvalue === "boolean") {
    return parseBool(src);
  } else if (isDate(refvalue)) {
    return parseDate(src);
  }
  return src;
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

/**
 * 
 * @param src 
 * @param refObject 
 * @returns a new object cloned from the refObject
 */
export function copyWithDataParsing(src: any, refObject: any): any {

  let dest = clone(refObject);
  for (let key in refObject) {
    if (!key.startsWith("___")) {
      if (key in src) {
        let refField = refObject[key];
        if (typeof refField == "number") {
          dest[key] = parseNum(src[key], refObject[key]);
        } else if (typeof refField == "string") {
          dest[key] = parseString(src[key], refObject[key]);
        } else if (typeof refField == "boolean") {
          dest[key] = parseBool(src[key], refObject[key]);
        } else if (isDate(refField)) {
          dest[key] = parseDate(src[key], refObject[key]);
        } else {
          // when the data is null, the isdate does not work
          // this is custom logic for our app
          if (key.toLowerCase().startsWith("datetime")) {
            dest[key] = parseDate(src[key], refObject[key]);
          } else if (key.toLowerCase().startsWith("date")) {
            // do not parse the date as a date value
            // this is custom logic for our app
            // dates must arrive to the database as a string to skip data conversion
            dest[key] = src[key];
          } else if (isObject(refField)) {
            // object, recursive data parsing
            if (isNullOrUndefined(src[key])) {
              src[key] = clone(refField);
            } else {
              dest[key] = copyWithDataParsing(src[key], refField);
            }
          } else if (isArray(refField) && isArray(src[key])) {
            // array of items, recursive data parsing
            // look for reference object for array
            let arrRefObject = refObject["___" + key];
            if (isObject(arrRefObject)) {
              for (let i = 0; i < src[key].length; i++) {
                dest[key].push(copyWithDataParsing(src[key][i], arrRefObject));
              }
            } else if (!isNullOrUndefined(arrRefObject)) {
              //we have a value single for a refobject
              for (let i = 0; i < src[key].length; i++) {
                dest[key].push(parse(src[key][i], arrRefObject));
              }

            } else {
              dest[key] = [...src[key]];
            }
          }
          else {
            //the field is not a datatype or date
            //could be a function, do not copy from src
            // dest[key] = src[key];
          }
        }
      }
    } else {
      delete dest[key];
    }
  }
  //assign the dest values, pick from src the dest fields
  // assign(dest, pick(src, keys(dest)));

  return dest;
}

