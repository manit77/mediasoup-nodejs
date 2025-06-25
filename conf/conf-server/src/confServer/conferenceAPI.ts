import express from 'express';
import { AuthenticateMsg, AuthenticateResultMsg, WebRoutes } from '@conf/conf-models';
import { ConferenceUtils } from './conferenceUtils.js';

const DSTR = "ConferenceAPI";

export class ConferenceAPI {

    constructor(private app: express.Express, private confUtils: ConferenceUtils) {

        app.get("/hello", (req, res) => {
            res.send("ConferenceAPI");
        });

        app.post(WebRoutes.authenticate, async (req, res) => {
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body as AuthenticateMsg;
            let loginResult: AuthenticateResultMsg = confUtils.authenticate(msgIn);
            res.send(loginResult);
        });
    }
}