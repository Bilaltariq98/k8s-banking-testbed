import express from "express";
import morgan from "morgan";
import jest from "jest";
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
app.use(morgan(logFormat));

app.get("/tests", (req, res) => {
    jest.run([]).then(() => {
        process.env["TEST_SUBNET"] = (process.env?.APP_NAMESPACE ? process.env.APP_NAMESPACE : ".default.svc.cluster.local");
        res.set("content-type", "text/html");
        res.send(template("test-report.html"));
    });
});

app.get("/tests/test-report.css", (req, res) => {
    res.set("content-type", "text/css");
    res.sendFile(process.env["PWD"] + "/test-report.css");
});

app.listen(port, () => {
    utils.log.info("Server listening at " + server);
});
