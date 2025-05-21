import express from 'express';
import { LoginMsg, LoginResultMsg } from '../models/conferenceSharedModels';
import * as jwt from '../utils/jwtUtil';
import { IAuthPayload } from '../models/models';
import { ConferenceUtils } from './conferenceUtils';


const DSTR = "ConferenceAPI";

export class ConferenceAPI {

    constructor(private app: express.Express, private confUtils : ConferenceUtils) {

        app.get("/hello", (req, res) => {
            res.send("ConferenceAPI");
        });

        app.post("/login", async (req, res) => {
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body as LoginMsg;
            let loginResult: LoginResultMsg = confUtils.login(msgIn);            
            res.send(loginResult);

        });
    }
}