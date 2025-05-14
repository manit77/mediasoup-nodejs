import jwt from "jsonwebtoken";

export function encode(secreteKey: string, obj: any) {
    try {
        return jwt.sign(obj, this.secretKey);
    } catch (err) {
        console.error(err);
    }
    return null;
}

export function decode(secreteKey: string, token: string) {
    try {
        return jwt.decode(token);
    } catch (err) {
        console.error(err);
    }
    return null;
}

