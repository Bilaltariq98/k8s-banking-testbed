import express from "express";
import morgan from "morgan";
import { taffy as TAFFY } from "taffydb";
import axios from "axios";
import dns from "dns";

// Details of this server
const port = 3000;
const server = `http://localhost:${port}`;

// Structure of a log message
const logFormat = ":date[iso] :status   [" + process.env["HOSTNAME"] + "] :method :url HTTP/:http-version :res[content-length]";

// Initialise a structure for our database
const db = { data: null, lastUpdated: null, errorMessage: null };

// Which services do we need to connect to (name and URL)
const services = {
    data: process.env?.TESTDATA_SERVICE_URL ? process.env.TESTDATA_SERVICE_URL : "http://testdata-service"
};

/**
 * Enrich log messages with timestamp and host
 */
const log = {
    format: (level, msg) => (new Date().toISOString()) + " " + level + " [" + process.env["HOSTNAME"] + "] " + msg,
    info: (msg) => console.log(log.format("INFO ", msg)),
    warn: (msg) => console.warn(log.format("WARN ", msg)),
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
 * Remove internal fields (starting with underscores) from an object
 */
const removeInternalFields = obj => Object.keys(obj).reduce((result, field) => {
    if (field.substr(0, 1) !== "_") {
        result[field] = obj[field];
    }
    return result;
}, {});

/**
 * Initialise the server from the test data service
 */
const initialiseData = (collection) => {

    return axios.get(services.data + "/testdata/" + collection)
        .then(response => {
            db.data = TAFFY(response.data);
            db.errorMessage = null;
            db.lastUpdated = Date.now();
            log.info("TESTDATA LOAD (" + JSON.stringify(services.data) + "): Successfully loaded");
            return true;
        })
        .catch(error => {
            log.warn("TESTDATA LOAD (" + JSON.stringify(services.data) + "): " + error.toString());
            db.errorMessage = collection + " service not available";
            return false;
        });
};

/**
 * Execute a database query and return a result
 */
const dbQuery = (query) => {

    if (db.errorMessage) {
        return {
            status: 500,
            data: {
                error: db.errorMessage
            }
        };
    };

    if (query) {
        return {
            status: 200,
            data: db.data(query).map(x => x)
        };
    }

    return {
        status: 200,
        data: db.data()
    };
};

/**
 * Create a promise from a timeout
 */
const timeoutPromise = (millis) => {
    return new Promise(resolve => {
        setTimeout(() => resolve(true), millis);
    });
};

/**
 * Poll the test data service until we get some data
 */
const populateTestData = (collection, depth = 1) => {
    const maxTries = 12;

    // Circuitbreaker
    if (depth > maxTries) {
        log.error("Unable to populate test data, exceeded maximum tries: " + maxTries);
        return;
    }

    // Wait for the longest of a data fetch attempt and a delay timer, then if
    // we've got nothing by that time, try again
    Promise.all([
        initialiseData(collection),
        timeoutPromise(1000)
    ]).then(([data, timeout]) => {
        if (!data) {
            populateTestData(collection, depth + 1);
        }
    });
};

/**
 * Handle a request for all items in the collection
 */
const getAllItems = (collection, req, res) => {
    const queryResult = dbQuery();
    if (queryResult.status === 200) {
        res.status(queryResult.status).send(queryResult.data.map(removeInternalFields));
    } else {
        res.status(queryResult.status).send(queryResult.data);
    }
};

/**
 * Handle a request for one or more specific items from a collection
 *
 * The format of the URL should be /<collection>/<item id>.  If the item id
 * contains one or more commas, the server will treat the request as a list of
 * resources to retrieve and return each one (or try to).
 *
 * If only one item id is passed, the object representing that item will be
 * returned.  If a list of items is passed, then an array of objects will be
 * returned.  Note that a request for a single item can be forced to return a
 * list, if a comma is included in the request (i.e. /<collection>/,<item id>
 * or /<collection>/<item id>,).
 */
const getSpecifiedItems = (collection, req, res) => {
    const pk = collection.replace(/s$/, "Id");
    const queryResult = dbQuery({[pk]: req.params.id.split(",")});

    if (queryResult.data.length === 0) {
        res.sendStatus(404);
    } else {
        if (req.params.id.includes(",")) {
            res.status(queryResult.status).send(queryResult.data.map(removeInternalFields));
        } else {
            res.status(queryResult.status).send(removeInternalFields(queryResult.data[0]));
        }
    }
};

/**
 * Return a list of items related to a specific item (or items) in a collection
 *
 * URL format should be /<collection>/<item id>/<name of related collection>.
 *
 * Note that the item id can be a comma-separated list, in which case a list of
 * items related to all the items from the comma-separated list will be
 * returned.
 */
const getRelatedItems = (collection, req, res) => {

    // Get the items from the collection
    const pk = collection.replace(/s$/, "Id");
    const queryResult = dbQuery({[pk]: req.params.id.split(",")});
    if (queryResult.length === 0) {
        res.sendStatus(404);
        return;
    }

    // Grab the id of the related items from the collection
    const relatedCollection = req.params.related;
    const fk = "_" + relatedCollection.replace(/s$/, "Ids");
    const subQueryResult = queryResult.data.map(x => x[fk]).filter(x => x);
    const flattenedResult = [].concat.apply([], subQueryResult);
    if (flattenedResult.length === 0) {
        res.sendStatus(404);
        return;
    }

    // Look up the server to get the related resource
    const relatedServer = services[relatedCollection];
    if (!relatedServer) {
        res.sendStatus(500);
        return;
    }

    // Make the API call to get the related resource
    // Use a comma to force the result to be an array, even if it's only for
    // one element
    const relatedUrl = relatedServer + "/" + relatedCollection + "/," + flattenedResult.join(",");
    axios.get(relatedUrl)
        .then(result => {
            res.status(200).send(result.data);
        })
        .catch(error => {
            res.sendStatus(500);
        });

};

/**
 * Create a promise for a DNS lookup
 */
const dnsPromise = (server) => {
    return new Promise(resolve => {
        dns.lookup(server, (error, result) => {
            if (error) {
                resolve({
                    address: null,
                    error: error.code
                });
            } else {
                resolve({
                    address: result
                });
            }
        });
    });
};

/**
 * Check test data server exists (and fall back to localhost if not)
 */
const checkDataServices = () => {
    const localServer = "http://localhost:8080";

    Object.keys(services).map(service => {
        const server = (new URL(services[service])).host;
        dnsPromise(server).then(result => {
            if (result.address) {
                log.info("Data server address resolved: " + server + " = " + result.address);
            } else {
                log.warn("Unable to resolve data server (" + server + "): " + result.error);
                services[service] = localServer;
                log.warn("Switched to alternative data server: " + localServer);
            }
        });
    });
};

/**
 * Health check - we're healthy if we have some data, we know when we got that
 * data, and we have no db errors
 */
const healthz = (req, res) => {
    if (db.data && db.lastUpdated && !db.errorMessage) {
        res.status(200).send({
            status: "healthy",
            "last-updated": db.lastUpdated
        });
    } else {
        res.status(500).send({
            status: "unhealthy",
            error: db.errorMessage.error
        });
    }
};

/**
 * Create and start our server
 *
 * 1) Make API call to testdata service to populate the data
 * 2) Create app server and initiate logging
 * 3) Add routes
 * 4) Start server
 *
 */
const restServer = (collection, relatedServers) => {

    const app = express();
    app.use(morgan(logFormat));

    app.get("/" + collection, (req, res) => {
        getAllItems(collection, req, res);
    });

    app.get("/" + collection + "/:id", (req, res) => {
        getSpecifiedItems(collection, req, res);
    });

    app.get("/" + collection + "/:id/:related", (req, res) => {
        getRelatedItems(collection, req, res);
    });

    app.get("/healthz", (req, res) => {
        healthz(req, res);
    });

    // Add the servers for related collections to our list of services
    Object.keys(relatedServers).map(k => { services[k] = relatedServers[k]; });

    // Check that all our data services exist
    checkDataServices();

    // Grab the data from our test data service
    populateTestData(collection);

    // Start the server
    app.listen(port, () => {
        log.info("Server listening at " + server);
    });
};

export { restServer };
