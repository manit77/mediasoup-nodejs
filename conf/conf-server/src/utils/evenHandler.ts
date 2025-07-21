
export abstract class AbstractEventHandler<T extends string> {
    protected callbacks: Map<T, Function[]> = new Map();
    protected enableLogs: boolean = true;
    protected logPre: string = "AbstractEventHandler";

    constructor(args: { enableLogs?: boolean; logPre?: string } = {}) {
        this.enableLogs = args.enableLogs ?? true;
        this.logPre = args.logPre ?? "AbstractEventHandler";
    }

    protected writeLog(...params: any) {
        if (this.enableLogs) {
            console.log(this.logPre, ...params);
        }
    }

    addEventHandler(type: T, callback: Function): boolean {
        this.writeLog(`addEventHandler for ${type}`);

        if (!callback) {
            this.writeLog("ERROR: callback is null");
            return false;
        }

        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
        }
        const arrCallBacks = this.callbacks.get(type)!;
        if (!arrCallBacks.includes(callback)) {
            arrCallBacks.push(callback);
            this.writeLog(`Added event handler for ${type}`);
            return true;
        } else {
            this.writeLog(`event handler already exists ${type}`);
            return false;
        }
    }

    removeEventHandler(type: T, callback: Function): boolean {
        this.writeLog(`removeEventHandler ${type}`);

        const cbarr = this.callbacks.get(type);
        if (cbarr) {
            const idx = cbarr.findIndex((cb) => cb === callback);
            if (idx > -1) {
                cbarr.splice(idx, 1);
                this.writeLog(`eventHandler removed ${type}`);
                return true;
            }
        }
        return false;
    }

    protected async fireEvent(type: T,...data: any) {
        if (this.callbacks.has(type)) {
            for (const cb of [...this.callbacks.get(type)!]) {
                await cb(...data);
            }
        }
    }
}