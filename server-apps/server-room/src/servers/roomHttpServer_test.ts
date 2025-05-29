import {
    AuthUserNewTokenMsg, AuthUserNewTokenResultMsg, RoomConfig
    , RoomNewMsg, RoomNewResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg, RoomServerAPIRoutes
    , RoomTerminateMsg, RoomTerminateResultMsg
} from "@rooms/rooms-models";
import { getENV } from "../utils/env.js";
import { Peer } from "../roomServer/peer.js";
import { Room } from "../roomServer/room.js";
import { RoomServer, RoomServerConfig } from "../roomServer/roomServer.js";
import { generateRoomToken } from "../roomServer/utils.js";
import { defaultHTTPServerSecurityMap, RoomHTTPServer } from "./roomHttpServer.js";
import express, { NextFunction, Request, Response } from 'express';
import supertest from "supertest";
import * as roomUtils from "../roomServer/utils.js";
import { describe, it, test, expect, beforeAll, afterAll } from 'vitest';

let timeout = 90000;

describe("roomServerTests", () => {
    let app: express.Express;
    let room_access_token: string;
    let roomServer: RoomServer;
    let config: RoomServerConfig;

    beforeAll(async () => {
        console.log("### beforeAll");
        config = await getENV("") as any;
        roomServer = new RoomServer(config);
        await roomServer.initMediaSoup();

        room_access_token = config["room_access_token"];

        app = express();
        app.use(express.json()); // Enable JSON parsing

        let roomHttp = new RoomHTTPServer(config, defaultHTTPServerSecurityMap, roomServer);
        roomHttp.initHTTPServer(app);

    }, timeout);

    afterAll(async () => {

        console.log("### afterAll");
        roomServer.dispose();
        expect(roomServer.getPeerCount()).toBe(0);
        expect(roomServer.getRoomCount()).toBe(0);

    }, timeout);

    test('hello', async () => {
        const response = await supertest(app).get('/hello');
        expect(response.status).toBe(200);
        expect(response.text).toBe('RoomHTTPServer');
        console.log(response.body);
    });

    test('newAuthUserTokenFail', async () => {

        let msgOut = new AuthUserNewTokenMsg();

        const response = await supertest(app)
            .post(RoomServerAPIRoutes.newAuthUserToken)
            .set('Authorization', `Bearer xxxxxxx`)
            .send(msgOut);

        expect(response.status).toBe(401);
        console.log(response.body);

    });


    test('newAuthUserToken', async () => {

        let msgOut = new AuthUserNewTokenMsg();

        const response = await supertest(app)
            .post(RoomServerAPIRoutes.newAuthUserToken)
            .set('Authorization', `Bearer ${room_access_token}`)
            .send(msgOut);

        expect(response.status).toBe(200);
        console.log(response.body);
        let resultMsg = response.body as AuthUserNewTokenResultMsg;
        expect(resultMsg.data.authToken).toBeTruthy();

    });

    test('newRoomToken', async () => {

        let msgOut = new RoomNewTokenMsg();

        const response = await supertest(app)
            .post(RoomServerAPIRoutes.newRoomToken)
            .set('Authorization', `Bearer ${room_access_token}`)
            .send(msgOut);

        expect(response.status).toBe(200);

        let resultMsg = response.body as RoomNewTokenResultMsg;

        expect(resultMsg.data.roomId).toBeTruthy();
        expect(resultMsg.data.roomToken).toBeTruthy();

    });

    test('newRoom', async () => {

        let [payload, roomToken] = roomUtils.generateRoomToken(config.room_secretKey, 1);

        let msgOut = new RoomNewMsg();
        msgOut.data.roomId = payload.roomId;
        msgOut.data.roomToken = roomToken;

        const response = await supertest(app)
            .post(RoomServerAPIRoutes.newRoom)
            .set('Authorization', `Bearer ${room_access_token}`)
            .send(msgOut);

        expect(response.status).toBe(200);

        let resultMsg = response.body as RoomNewResultMsg;
        console.log(resultMsg.data.error);
        expect(resultMsg.data.roomId).toBeTruthy();
        expect(resultMsg.data.roomToken).toBeTruthy();

        let room = roomServer.getRoom(resultMsg.data.roomId);
        expect(room).toBeTruthy();
        room.close("test");

        expect(roomServer.getRoomCount()).toBe(0);

    });

    test('terminateRoom', async () => {

        let [payload, roomToken] = roomUtils.generateRoomToken(config.room_secretKey, 1);

        let roomConfig = new RoomConfig();
        let room = await roomServer.createRoom(payload.roomId, roomToken, roomConfig);

        let msgOut = new RoomTerminateMsg();
        msgOut.data.roomId = room.id;
        msgOut.data.roomToken = roomToken;

        const response = await supertest(app)
            .post(RoomServerAPIRoutes.terminateRoom)
            .set('Authorization', `Bearer ${room_access_token}`)
            .send(msgOut);

        expect(response.status).toBe(200);

        let resultMsg = response.body as RoomTerminateResultMsg;
        expect(resultMsg.data.error).toBeFalsy();
        expect(roomServer.getRoomCount()).toBe(0);

    });


});