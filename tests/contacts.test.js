const supertest = require("supertest");
const request = supertest("http://" + ( process.env["TEST_SUBNET"]
                                            ? (process.env?.CONTACTS_SERVICE_URL ? process.env.CONTACTS_SERVICE_URL : "contacts-service") + process.env["TEST_SUBNET"]
                                            : "localhost:8080"));

const contactFields = [
    "contactId",
    "street",
    "city",
    "county",
    "postCode",
    "phone",
    "email"
];

var collectionCache = null;

/**
 * Get a random item from the collection cache
 */
const getRandomItem = () => {
    const selection = Math.floor(Math.random() * collectionCache.length);
    const result = collectionCache[selection];
    collectionCache.splice(selection, 1);
    return result;
};

/**
 * Sort an array by element id
 */
const byId = (idField) => {
    return (a, b) => {
        if (a[idField] < b[idField]) { return -1; }
        if (a[idField] > b[idField]) { return 1; }
        return 0;
    };
};

describe("/contacts", () => {
    it("gets the list of contact details", async () => {
        const response = await request.get("/contacts");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(typeof response.body[0]).toBe("object");
        contactFields.forEach(field => {
            expect(response.body[0][field]).toBeDefined();
        });
        collectionCache = response.body;
    });
});

describe("/contacts/:id", () => {
    it("gets a specified contact detail", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/contacts/" + targetItem.contactId);
        expect(response.status).toBe(200);
        expect(typeof response.body).toBe("object");
        contactFields.forEach(field => {
            expect(response.body[field]).toBe(targetItem[field]);
        });
    });

    it("returns a 404 error for a non-existent contact detail", async () => {
        const response = await request.get("/contacts/x");
        expect(response.status).toBe(404);
    });

    it("gets a specified contact detail as an array, due to a leading comma", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/contacts/," + targetItem.contactId);
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
        expect(typeof response.body[0]).toBe("object");
        contactFields.forEach(field => {
            expect(response.body[0][field]).toBe(targetItem[field]);
        });
    });

    it("gets a specified contact details as an array, due to a trailing comma", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/contacts/" + targetItem.contactId + ",");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
        expect(typeof response.body[0]).toBe("object");
        contactFields.forEach(field => {
            expect(response.body[0][field]).toBe(targetItem[field]);
        });
    });

    it("gets multiple specified contact details, when comma-separated", async () => {
        const numberOfItems = 3;
        const targetItems = [...Array(numberOfItems)].map(x => getRandomItem()).sort(byId("contactId"));
        const response = await request.get("/contacts/" + targetItems.map(x => x.contactId).join(","));
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(numberOfItems);
        const returnedItems = response.body.sort(byId("contactId"));
        for (let i = 0; i < numberOfItems; i++) {
            contactFields.forEach(field => {
                expect(returnedItems[i][field]).toBe(targetItems[i][field]);
            });
        }
    });
});

describe("/contacts/:id/customers", () => {
    it("gets list of customers for a specified contact detail", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/contacts/" + targetItem.contactId + "/customers");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it("gets customer list when multiple contact details are specified", async () => {
        const numberOfItems = 3;
        const targetItems = [...Array(numberOfItems)].map(x => getRandomItem()).sort(byId("contactId"));
        const response = await request.get("/contacts/" + targetItems.map(x => x.contactId).join(",") + "/customers");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
