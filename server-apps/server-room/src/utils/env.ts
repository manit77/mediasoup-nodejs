import { join, dirname } from 'path';
import * as util from './utils'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getENV(dir: string = ""): Promise<any> {

    if (util.stringIsNullOrEmpty(dir)) {
        dir = __dirname;
    }

    let envFileName = ".env.json";
    let env = null;
    let filepath = join(dir, envFileName);

    console.log(`trying ${filepath}`);
    if (util.fileExists(filepath)) {
        env = JSON.parse(await util.readFile(filepath));
    } else {
        dir = process.cwd();
        filepath = join(dir, envFileName);
        if (util.fileExists(filepath)) {
            env = JSON.parse(await util.readFile(filepath));
        }
    }

    if (env) {
        console.log(`loading env from ${filepath}`);
    }

    if (env == null) {
        console.log("loading env from process");
        env = process.env;
    } else {
        //merge process env and env from file
        //do not overwrite process env with env
        for (let key in process.env) {
            if (!util.hasKey(env, key)) {
                env[key] = process.env[key];
            }
        }
    }

    return env;
}