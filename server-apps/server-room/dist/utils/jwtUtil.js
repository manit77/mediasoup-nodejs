import jwt from "jsonwebtoken";
export function jwtSign(secret, obj, expiresInMin) {
    try {
        if (expiresInMin && expiresInMin > 0) {
            return jwt.sign(obj, secret, { expiresIn: `${expiresInMin}m` });
        }
        else {
            return jwt.sign(obj, secret);
        }
    }
    catch (err) {
        console.error(err);
    }
    return null;
}
export function jwtVerify(secret, token) {
    try {
        return jwt.verify(token, secret);
    }
    catch (err) {
        console.error(err);
    }
    return null;
}
