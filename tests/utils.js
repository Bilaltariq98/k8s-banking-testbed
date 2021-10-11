import dns from "dns";
import axios from "axios";
import fs from "fs";

const templateServer =  process.env?.FRONTEND_SERVICE_DNS ? process.env.FRONTEND_SERVICE_DNS : "frontend-service.default.svc.cluster.local";

/**
 * Functions to control display of logging
 */
const log = {
    format: (level, msg) => (new Date().toISOString()) + " " + level + " [" + process.env["HOSTNAME"] + "] " + msg,
    info: (msg) => console.log(log.format("INFO ", msg)),
    warn: (msg) => console.warn(log.format("WARN ", msg)),
    error: (msg) => console.error(log.format("ERROR", msg))
};

/**
 * Set up the template mechanism
 *
 * Load the values file, get the template, and populate it.
 */
const initialiseTemplate = () => {
    var template = null;

    /**
     * Fill in the template from a values string
     */
    const fillTemplate = (template, values) => {
        const fields = template.match(/{{.*?}}/g);

        fields.forEach(field => {
            const tag = field.replace(/^{{ */, "").replace(/ *}}/, "");
            const regex = new RegExp("<!-- " + tag + " -->\(.*\)<!-- /" + tag + " -->", "s");
            const value = regex.exec(values);

            if (value === null) {
                template = template.replace(field, "");
            } else {
                template = template.replace(field, value[1]);
            }
        });

        return template;
    };

    /**
     * Call the template server to get the template
     */
    const getFromTemplateServer = (server, filename) => {

        axios.get("http://" + server + "/" + filename).then(response => {
            template = response.data;
            log.info("Frontend template loaded");
        }).catch(error => {
            log.warn("Unable to load frontend template, will retry");
            setTimeout(() => {
                getFromTemplateServer(server, filename);
            }, 3000);
        });
    };

    /**
     * Load in the page template
     */
    const loadTemplate = () => {
    
        dns.lookup(templateServer, (error, result) => {
            if (error) {
                log.warn("Unable to resolve DNS for template server: " + templateServer);
            } else {
                getFromTemplateServer(templateServer, "template.html");
            }
        });
    };

    // Load in the template
    loadTemplate();

    // Return a function, which checks for the template and returns it (if it's
    // there) and the values file itself if it isn't
    return (valuesFile) => {
        const values = fs.readFileSync(valuesFile, "utf8");
        return template ? fillTemplate(template, values) : values;
    }
};

const utils = {

    log,
    template: initialiseTemplate
};

export default utils;
