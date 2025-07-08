import { IAuthPayload } from "../models/models.js";
import { AuthenticateMsg, AuthenticateResultMsg } from "@conf/conf-models";
import * as jwt from '../utils/jwtUtil.js';

export class ConferenceUtils {

    config = {
        secretKey: "IFXBhILlrwNGpOLK8XDvvgqrInnU3eZ1", //override with your secret key from a secure location
        authTokenExpiresInMinutes: 60 * 24 * 1 //0 for never expires
    }

    authenticate(msgIn: AuthenticateMsg) {
        let userName = msgIn.data.username;
        let password = msgIn.data.password;

        let authResult = new AuthenticateResultMsg();
        let dbResult = true; //get from database
        if (!dbResult) {
            authResult.data.error = "invalid username and password";
            return authResult;
        }

        let payload: IAuthPayload = {         
            username: userName,
            role: "user"
        };       

        let authToken = jwt.jwtSign(this.config.secretKey, payload);

        if (authToken) {
            authResult.data.error = "login failed";
        }

        return authResult;
    }



    validateAuthToken(token: string): boolean {
        try {
            // Verify and decode the token
            const payload = jwt.jwtVerify(this.config.secretKey, token) as IAuthPayload;

            // Check if roomId exists in the payload
            if (!payload.username) {
                return false;
            }

            // Token is valid
            return true;
        } catch (error) {
            // Handle JWT verification errors (e.g., invalid signature, malformed token)
            console.error(error);
        }

        return false;
    }
}