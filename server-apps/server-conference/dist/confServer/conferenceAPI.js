import { WebRoutes } from '@conf/conf-models';
const DSTR = "ConferenceAPI";
export class ConferenceAPI {
    app;
    confUtils;
    constructor(app, confUtils) {
        this.app = app;
        this.confUtils = confUtils;
        app.get("/hello", (req, res) => {
            res.send("ConferenceAPI");
        });
        app.post(WebRoutes.authenticate, async (req, res) => {
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body;
            let loginResult = confUtils.authenticate(msgIn);
            res.send(loginResult);
        });
    }
}
//# sourceMappingURL=conferenceAPI.js.map