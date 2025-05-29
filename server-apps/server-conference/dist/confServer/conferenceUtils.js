import * as jwt from '../utils/jwtUtil.js';
export class ConferenceUtils {
    config = {
        secretKey: "IFXBhILlrwNGpOLK8XDvvgqrInnU3eZ1", //override with your secret key from a secure location
        authTokenExpiresInMinutes: 60 * 24 * 1 //0 for never expires
    };
    login(msgIn) {
        let userName = msgIn.data.username;
        let password = msgIn.data.password;
        let loginResult = { type: "loginResult", data: { authToken: "" } };
        let dbResult = true; //get from database
        if (!dbResult) {
            loginResult.data.error = "invalid username and password";
            return loginResult;
        }
        let payload = {
            expiresIn: 0,
            username: userName
        };
        if (this.config.authTokenExpiresInMinutes > 0) {
            payload.expiresIn = Math.floor(Date.now() / 1000) + (this.config.authTokenExpiresInMinutes * 60);
        }
        let authToken = jwt.jwtSign(this.config.secretKey, payload);
        if (authToken) {
            loginResult.data.error = "login failed";
        }
        return loginResult;
    }
    validateAuthToken(token) {
        try {
            // Verify and decode the token
            const payload = jwt.jwtVerify(this.config.secretKey, token);
            // Check if roomId exists in the payload
            if (!payload.username) {
                return false;
            }
            if (payload.expiresIn > 0) {
                // Check expiration (if expiresIn or exp is used)
                const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
                if (payload.expiresIn && payload.expiresIn < currentTime) {
                    return false;
                }
            }
            // Token is valid
            return true;
        }
        catch (error) {
            // Handle JWT verification errors (e.g., invalid signature, malformed token)
            console.error(error);
        }
        return false;
    }
}
//# sourceMappingURL=conferenceUtils.js.map