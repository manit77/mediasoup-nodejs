import jwt from "jsonwebtoken";
export function jwtSign(secret, obj) {
    try {
        return jwt.sign(obj, secret);
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
//# sourceMappingURL=jwtUtil.js.map