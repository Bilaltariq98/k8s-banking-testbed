import { restServer } from "./rest.js";

restServer("accounts", {
    customers: process.env?.CUSTOMER_SERVICE_URL ? process.env.CUSTOMER_SERVICE_URL : "http://customer-service",
    transactions: process.env?.TRANSACTIONS_SERVICE_URL ? process.env.TRANSACTIONS_SERVICE_URL : "http://transactions-service"
});