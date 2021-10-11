import { restServer } from "./rest.js";

restServer("contacts", {
    customers: process.env?.CUSTOMER_SERVICE_URL ? process.env.CUSTOMER_SERVICE_URL : "http://customer-service"
});
