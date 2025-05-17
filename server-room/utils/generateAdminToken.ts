import { AuthUserTokenPayload, AuthUserRoles } from "../models/tokenPayloads";
import { jwtSign } from "./jwtUtil";


let payload: AuthUserTokenPayload = {
    role: AuthUserRoles.admin
};
const secretKey = process.env.ROOMS_SECRET;

if (!secretKey) {
    console.log("no env variable set for ROOMS_SECRET");
}

console.log(jwtSign(secretKey, payload));
