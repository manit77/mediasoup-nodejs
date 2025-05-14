import jwt from "jsonwebtoken";

export function jwtSign(secret: string, obj: any) {
    try {
        return jwt.sign(obj, secret);
    } catch (err) {
        console.error(err);
    }
    return null;
}

export function jwtVerify(secret: string, token: string) {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        console.error(err);
    }
    return null;
}

