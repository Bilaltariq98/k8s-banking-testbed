const supertest = require("supertest");
const request = supertest("http://" + ( process.env["TEST_SUBNET"]
                                            ? (process.env?.CUSTOMER_SERVICE_URL ? process.env.CUSTOMER_SERVICE_URL : "customer-service") + process.env["TEST_SUBNET"]
                                            : "localhost:8080"));

const customerFields = [
    "customerId",
    "title",
    "firstName",
    "lastName"
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

describe("/customers", () => {
    it("gets the list of customers", async () => {
        const response = await request.get("/customers");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(typeof response.body[0]).toBe("object");
        customerFields.forEach(field => {
            expect(response.body[0][field]).toBeDefined();
        });
        collectionCache = response.body;
    });
});

describe("/customers/:id", () => {
    it("gets a specified customer", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/customers/" + targetItem.customerId);
        expect(response.status).toBe(200);
        expect(typeof response.body).toBe("object");
        customerFields.forEach(field => {
            expect(response.body[field]).toBe(targetItem[field]);
        });
    });

    it("returns a 404 error for a non-existent customer", async () => {
        const response = await request.get("/customers/x");
        expect(response.status).toBe(404);
    });

    it("gets a specified customer as an array, due to a leading comma", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/customers/," + targetItem.customerId);
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
        expect(typeof response.body[0]).toBe("object");
        customerFields.forEach(field => {
            expect(response.body[0][field]).toBe(targetItem[field]);
        });
    });

    it("gets a specified customer as an array, due to a trailing comma", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/customers/" + targetItem.customerId + ",");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);
        expect(typeof response.body[0]).toBe("object");
        customerFields.forEach(field => {
            expect(response.body[0][field]).toBe(targetItem[field]);
        });
    });

    it("gets multiple specified customers, when comma-separated", async () => {
        const numberOfItems = 3;
        const targetItems = [...Array(numberOfItems)].map(x => getRandomItem()).sort(byId("customerId"));
        const response = await request.get("/customers/" + targetItems.map(x => x.customerId).join(","));
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(numberOfItems);
        const returnedItems = response.body.sort(byId("customerId"));
        for (let i = 0; i < numberOfItems; i++) {
            customerFields.forEach(field => {
                expect(returnedItems[i][field]).toBe(targetItems[i][field]);
            });
        }
    });
});

describe("/customers/:id/contacts", () => {
    it("gets contact details for a specified customer", async () => {
        const targetItem = getRandomItem();
        const response = await request.get("/customers/" + targetItem.customerId + "/contacts");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it("gets contact details when multiple customers are specified", async () => {
        const numberOfItems = 3;
        const targetItems = [...Array(numberOfItems)].map(x => getRandomItem()).sort(byId("customerId"));
        const response = await request.get("/customers/" + targetItems.map(x => x.customerId).join(",") + "/contacts");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
