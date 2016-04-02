
"use strict";

const fs = require("fs"),
    path = require("path"),
    colors = require("colors");

function log() {

    /*eslint-disable no-console*/
    console.log(...[colors.cyan("[Config]"), ...arguments]);
    /*eslint-enable no-console*/

}

function error() {

    /*eslint-disable no-console*/
    console.error(...[colors.cyan("[Config]"), ...arguments]);
    /*eslint-enable no-console*/

}

module.exports = (filePath, callback) => {

    if (typeof filePath === "function") {

        callback = filePath;
        filePath = path.join(path.dirname(require.main.filename), "config/config.json");

    }

    // console.log(`Loading config file '${filePath}'`);

    fs.readFile(filePath, (err, data) => {

        if (err) {

            error(`Error opening config file '${filePath}', exiting`);
            process.exit(1);

        }

        try {

            data = JSON.parse(data.toString());
            log(`Loaded config file '${filePath}'`);

        } catch (e) {

            error(`Error parsing config file '${filePath}', exiting`);
            process.exit(1);

        }

        callback(data);

    });

};
