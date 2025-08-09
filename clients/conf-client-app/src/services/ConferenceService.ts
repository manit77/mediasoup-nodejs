import { ConferenceClient } from "@conf/conf-client";

// Tell TypeScript about our global variable so it doesn't complain
declare global {
  // eslint-disable-next-line no-var
  var __conferenceClient: ConferenceClient | undefined;
}

// Only create it once
if (!globalThis.__conferenceClient) {
  globalThis.__conferenceClient = new ConferenceClient();
}

export const conferenceClient = globalThis.__conferenceClient!;