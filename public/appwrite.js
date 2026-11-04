import { Client } from "https://sdk.appwrite.io/web/29.2.0/client.js";

export const APPWRITE_ENDPOINT =
  "https://fra.cloud.appwrite.io/v1";

export const APPWRITE_PROJECT_ID =
  "6aeb5d2e00312d3a4300";

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Appwrite connectivity check
client.ping = async function () {
  const response = await fetch(
    `${APPWRITE_ENDPOINT}/health/version`,
    {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Appwrite error: ${response.status}`);
  }

  return response.json();
};
