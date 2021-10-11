import { restServer } from "./rest.js";

restServer("customers", {
    accounts: process.env?.ACCOUNTS_SERVICE_URL ? process.env.ACCOUNTS_SERVICE_URL : "http://accounts-service",
    contacts: process.env?.CONTACTS_SERVICE_URL ? process.env.CONTACTS_SERVICE_URL : "http://contacts-service"
});
