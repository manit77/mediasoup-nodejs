import { ConferenceRoomConfig, ConferenceScheduledInfo } from "@conf/conf-models";

export function getDemoSchedules() {
    let scheduled = [new ConferenceScheduledInfo(), new ConferenceScheduledInfo(), new ConferenceScheduledInfo()];
    scheduled[0].externalId = "1";
    scheduled[0].name = "Room 1";
    scheduled[0].description = "No conf code needed.";
    scheduled[0].config = new ConferenceRoomConfig();

    scheduled[1].externalId = "2";
    scheduled[1].name = "Room 2";
    scheduled[1].description = "guest requires conf code, guest no cam.";
    scheduled[1].config = new ConferenceRoomConfig();
    scheduled[1].config.conferenceCode = "2222";
    scheduled[1].config.usersRequireConferenceCode = false;
    scheduled[1].config.guestsRequireConferenceCode = true;


    scheduled[2].externalId = "3";
    scheduled[2].name = "Room 3";
    scheduled[2].description = "requires conf code. guest no cam or mic.";
    scheduled[2].config = new ConferenceRoomConfig();
    scheduled[2].config.guestsAllowCamera = false;
    scheduled[2].config.guestsAllowMic = false;
    scheduled[2].config.conferenceCode = "3333";
    scheduled[2].config.guestsRequireConferenceCode = true;
    scheduled[2].config.usersRequireConferenceCode = true;

    return scheduled;
}