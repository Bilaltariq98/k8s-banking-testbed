import express from "express";
import { taffy as TAFFY } from "taffydb";
import { v4 as uuid } from "uuid";
import faker from "faker";

/**
 * Enrich log messages with timestamp and host
 */
const log = {
    format: (level, msg) => (new Date().toISOString()) + " " + level + " [" + process.env["HOSTNAME"] + "] " + msg,
    info: (msg) => console.log(log.format("INFO ", msg)),
    error: (msg) => console.error(log.format("ERROR", msg))
};

/**
 * Allow Control-C interrupt
 */
process.on("SIGINT", () => {
    log.info("Server received interrupt signal");
    process.exit();
});

/**
 * Set up server, and initialise locale
 */
const port = 3000;
const server = `http://localhost:${port}`;
const app = express();
faker.locale = "en_GB";

/**
 * What does a person record contain?
 */
const person = {
    title: faker.name.prefix,
    firstName: faker.name.firstName,
    lastName: faker.name.lastName
};

/**
 * What does a person's contact details look like?
 */
const contactDetails = {
    street: faker.address.streetAddress,
    city: faker.address.cityName,
    county: faker.address.county,
    postCode: faker.address.zipCode,
    phone: faker.phone.phoneNumber,
    email: faker.internet.email
};

/**
 * What does a bank account contain?
 */
const account = {
    sortCode: () => ("" + (faker.datatype.number() * 1000 + faker.datatype.number())).replace(/(..)(..)(..).*/, '$1-$2-$3'),
    accountNumber: faker.finance.account,
    branch: () => faker.address.streetName() + ", " + faker.address.cityName() + ", " + faker.address.zipCode(),
    balance: faker.finance.amount
};

/**
 * What does a transaction look like?
 */
const transaction = {
    date: faker.date.recent,
    description: faker.finance.transactionDescription
};

/**
 * Create a list of 'length' UUIDs, using the supplied key
 */
const uuidList = (key, length) => Array.from({length}, () => ({[key]: uuid()}));

/**
 * Create a record of type 'recordType'
 *
 * Given an object where the values are functions, create an instance of the
 * object by calling each of the functions
 */
const createRecord = (recordType, initialRecord) => Object.keys(recordType).reduce((result, field) => {
    result[field] = recordType[field]();
    return result;
}, initialRecord);

/**
 * Given two collections, assign members of the second to the first
 *
 * Assumption is that this is a many to one mapping
 */
const linkCollections = (primary, pk, secondary, fk) => {
    const fkFromPrimary = "_" + fk + "s";
    const fkFromSecondary = "_" + pk + "s";

    secondary().select(fk).forEach(sourceItem => {

        const primaryIds = primary();
        let selectionList = primaryIds.map(x => x[fkFromPrimary] ? null : x[pk]).filter(x => x);
        if (selectionList.length === 0) {
            selectionList = primaryIds.map(x => x[pk]);
        }
        const targetItem = selectionList[Math.floor(selectionList.length * Math.random())];

        // Add the secondary to an array of foreign keys in the primary
        const primaryLinks = primary({[pk]: targetItem}).select(fkFromPrimary)[0] || [];
        primaryLinks.push(sourceItem);
        primary({[pk]: targetItem}).update({[fkFromPrimary]: primaryLinks});

        // Add the primary to an array of foreign keys from the secondary
        const secondaryLinks = secondary({[fk]: sourceItem}).select(fkFromSecondary)[0] || [];
        secondaryLinks.push(targetItem);
        secondary({[fk]: sourceItem}).update({[fkFromSecondary]: secondaryLinks});
    });
};

/**
 * Go through the list of contacts and update the email address to match the
 * linked customer
 */
const updateEmailAddresses = () => {
    db.contacts().join(db.customers, function (l, r) {
        return (l._customerIds[0] === r.customerId);
    })
    .select("contactId", "email", "firstName", "lastName")
    .forEach(([contactId, email, firstName, lastName], n) => {
        email = (firstName + "." + lastName + email.replace(/.*@/, "@")).toLowerCase();
        db.contacts({contactId}).update({email});
    });
};


/**
 * Create the collections in the database
 */
const db = {
    customers: TAFFY(uuidList("customerId", 100).map(uuidObject => createRecord(person, uuidObject))),
    contacts: TAFFY(uuidList("contactId", 120).map(uuidObject => createRecord(contactDetails, uuidObject))),
    accounts: TAFFY(uuidList("accountId", 150).map(uuidObject => createRecord(account, uuidObject))),
    transactions: TAFFY(uuidList("transactionId", 3000).map(uuidObject => createRecord(transaction, uuidObject)))
};
linkCollections(db.customers, "customerId", db.contacts, "contactId");
updateEmailAddresses();
linkCollections(db.customers, "customerId", db.accounts, "accountId");
linkCollections(db.accounts, "accountId", db.transactions, "transactionId");

/**
 * Handle the top-level request to our server, which just returns a list of the available collections
 */
app.get("/testdata", (req, res) => {
    res.send({
        collections: Object.keys(db),
        _links: Object.keys(db).map(x => server + "/" + x),
        _version: '0.3.develop'
    });
});

/**
 * Handle a request for a specific collection
 */
app.get("/testdata/:collection", (req, res) => {

    if (!db[req.params.collection]) {
        res.sendStatus(404);
        return;
    }

    res.send(db[req.params.collection]().stringify());
});

/**
 * Start our server
 */
app.listen(port, () => {
    log.info("Server listening at " + server);
});
