import { IAuthPayload } from "../models/models.js";
import { AuthenticateMsg, AuthenticateResultMsg, LoginMsg } from "@conf/conf-models";
import * as jwt from '../utils/jwtUtil.js';
import { ConferenceServerConfig } from "./conferenceServer.js";

export class AuthUtils {

    constructor(private config: ConferenceServerConfig) {

    }

    /**
     * 
     * @param msgIn 
     * @returns 
     */
    login(msgIn: LoginMsg) {
        let username = msgIn.data.username;
        let password = msgIn.data.password;

        let authResult = new AuthenticateResultMsg();
        let dbResult = true; //get from database
        if (!dbResult) {
            authResult.data.error = "invalid username and password";
            return authResult;
        }

        let payload: IAuthPayload = {
            username: username,
            role: "user"
        };

        let authToken = jwt.jwtSign(this.config.conf_secret_key, payload);

        if (authToken) {
            authResult.data.error = "login failed";
        }

        return authResult;
    }

    validateAuthToken(token: string): boolean {
        try {
            // Verify and decode the token
            const payload = jwt.jwtVerify(this.config.conf_secret_key, token) as IAuthPayload;

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