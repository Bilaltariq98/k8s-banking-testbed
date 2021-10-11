import { restServer } from "./rest.js";

restServer("transactions", {
    accounts: process.env?.ACCOUNTS_SERVICE_URL ? process.env.ACCOUNTS_SERVICE_URL : "http://accounts-service"
});
