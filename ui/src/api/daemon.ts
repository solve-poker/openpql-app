// Daemon-backed API implementation (dev mode): re-exports existing REST + WS clients.
export { apiParse, apiValidateRange, apiGames } from "./rest";
export { RunClient, type ServerMsg } from "./ws";
