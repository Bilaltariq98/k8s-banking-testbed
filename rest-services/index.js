import { restServer } from "./rest.js";

restServer("customers", {
    contacts: process.env?.CONTACTS_SERVICE_URL ? process.env.CONTACTS_SERVICE_URL : "http://contacts-service"
});
