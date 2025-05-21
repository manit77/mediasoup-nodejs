import { AuthUserRoles } from "../models/tokenPayloads";
import { jwtSign } from "./jwtUtil";
let payload = {
    role: AuthUserRoles.admin
};
const secretKey = process.env.room_secretKey;
if (!secretKey) {
    console.log("no env variable set for room_secretKey: export room_secretKey=your-secure-secret-key");
}
console.log(jwtSign(secretKey, payload));
