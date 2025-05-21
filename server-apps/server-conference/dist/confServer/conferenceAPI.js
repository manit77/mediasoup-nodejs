const DSTR = "ConferenceAPI";
export class ConferenceAPI {
    constructor(app, confUtils) {
        this.app = app;
        this.confUtils = confUtils;
        app.get("/hello", (req, res) => {
            res.send("ConferenceAPI");
        });
        app.post("/login", async (req, res) => {
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body;
            let loginResult = confUtils.login(msgIn);
            res.send(loginResult);
        });
    }
}
