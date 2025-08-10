import { ConferenceClient } from "@conf/conf-client";

declare global {
  var __conferenceClient: ConferenceClient | undefined;
}

export const getConferenceClient = (): ConferenceClient => {
  if (!globalThis.__conferenceClient) {
    globalThis.__conferenceClient = new ConferenceClient();
  }
  return globalThis.__conferenceClient;
};
