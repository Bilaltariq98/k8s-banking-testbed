import express from "express";
import morgan from "morgan";
import k8s from "@kubernetes/client-node";
import utils from "./utils.js";

process.on("SIGINT", () => {
    utils.log.info("Server received interrupt signal");
    process.exit();
});

const port = 3000;
const server = `http://localhost:${port}`;
const template = utils.template();
const logFormat = ":date[iso] :status   [" + process.env["HOSTNAME"] + "] :method :url HTTP/:http-version :res[content-length]";
const app = express();
app.enable("strict routing");
app.use(express.static("public"));
app.use(morgan(logFormat));

// Our k8s API
var k8sApi = null;

/**
 * Set up the library to access the k8s API
 */
const initialiseK8s = () => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
};

/**
 * Loop to wait until k8s API is available
 */
const k8sInitialisationLoop = () => {

    try {
        initialiseK8s();
    } catch (err) {
        utils.log.warn("Unable to connect to k8s API: " + err.message + " (retrying)");
        setTimeout(() => {
            k8sInitialisationLoop();
        }, 10000);
    }
};
k8sInitialisationLoop();

/**
 * Convert an array of objects to an object of arrays, using a field within
 * each object as a key
 */
const arrayToObject = (arr, keyName) => {
    return arr.reduce((result, elem) => {

        const key = elem[keyName];
        if (!result[key]) {
            result[key] = [];
        }
        delete elem[keyName];
        result[key].push(elem);

        return result;
    }, {});
};

/**
 * Analyse the status of the pod and return a simple answer
 */
const analysePodStatus = (status, markedForDeletion) => {

    if (markedForDeletion) {
        return "terminating";
    }

    const analysis = status.reduce((result, item) => {
        result[item.type] = item.status;
        return result;
    }, {});

    if (analysis.Ready) {
        return "ready";
    }

    if (analysis.Initialized) {
        return "pending";
    }

    return "unknown";
};

/**
 * Grab the info we want from a pod description
 */
const analysePod = (pod) => {
    return {
        name: pod.metadata.name,
        app: pod.metadata.labels.app,
        node: pod.spec.nodeName,
        ready: {
            status: analysePodStatus(pod.status.conditions, pod.metadata.deletionTimestamp),
            containers: pod.status.containerStatuses.map(container => ({
                name: container.name,
                status: container.ready ? "ready" : "pending",
                restarts: container.restartCount
            }))
        }
    };
};

/**
 * Get a list of pods in our namespace
 */
const getPods = (ns) => {
    return k8sApi.listNamespacedPod(ns)
        .then(data => {
            return arrayToObject(data.body.items.map(analysePod), "app");
        })
        .catch(err => {
            utils.log.error("Error getting pods: " + err.response.body.code + " " + err.response.body.message);
            return {};
        });
};

/**
 * Grab the info we want from a pod description
 */
const analyseService = (srv) => {
    return {
        name: srv.metadata.name,
        app: srv.spec.selector && srv.spec.selector.app
    };
};

/**
 * Get a list of services in our namespace
 */
const getServices = (ns) => {
    return k8sApi.listNamespacedService(ns)
        .then(data => {
            return data.body.items
                .map(analyseService)
                .filter(srv => srv.app)
                .reduce((result, service) => {
                    result[service.name] = service.app;
                    return result;
                }, {});
        })
        .catch(err => {
            utils.log.error("Error getting services: " + err.response.body.code + " " + err.response.body.message);
            return {};
        });
};

/**
 * Get all the monitoring data and aggregate it
 */
const getMonitoringData = (ns) => {

    return Promise.all([
        getServices(ns),
        getPods(ns)
    ]).then(([services, pods]) => {
        return {
            services,
            pods
        };
    }).catch(err => {
        utils.log.error("Request failed: " + err.code);
    });
};

/**
 * Get the logs from a container
 */
const getLogs = (ns, pod, container) => {
    return k8sApi.readNamespacedPodLog(pod, ns, container)
            .then(data => data.response.body.split("\n"))
            .catch(err => { return null; });
};

app.get("/monitoring", (req, res) => {
    res.redirect("/monitoring/");
});

app.get("/monitoring/", (req, res) => {
    res.set("content-type", "text/html");
    res.send(template("monitoring.html"));
});

app.get("/monitoring/data", (req, res) => {
    if (!k8sApi) {
        res.status(503).send({ error: "Waiting for kubernetes to become available" });
        return;
    }
    Promise.all([
        getMonitoringData(process.env?.APP_NAMESPACE ? process.env.APP_NAMESPACE : "default"),
        getMonitoringData("operations")
    ]).then(data => {
        return data.reduce((result, obj) => {
            Object.keys(obj).forEach(key => {
                if (result[key]) {
                    result[key] = Object.assign({}, result[key], obj[key]);
                } else {
                    result[key] = Object.assign({}, obj[key]);
                }
            });
            return result;
        }, {});
    }).then(x => { res.send(x); });
});

app.get("/monitoring/logs/:pod/:container", (req, res) => {
    if (!k8sApi) {
        res.status(503).send({ error: "Waiting for kubernetes to become available" });
        return;
    }
    getLogs(process.env?.APP_NAMESPACE ? process.env.APP_NAMESPACE : "default", req.params.pod, req.params.container).then(x => { res.send(x); });
});

app.listen(port, () => {
    utils.log.info("Server listening at " + server);
});
