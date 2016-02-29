
"use strict";

const fs = require("fs"),
    path = require("path");

module.exports = (filePath, callback) => {

    if (typeof filePath === "function") {

        callback = filePath;
        filePath = path.join(path.dirname(require.main.filename), "config/config.json");

    }

    console.log(`Loading config file '${filePath}'`);

    fs.readFile(filePath, (err, data) => {

        if (err) {

            console.error(`Error opening config file '${filePath}', exiting`);
            process.exit(1);

        }

        try {

            data = JSON.parse(data.toString());

        } catch (e) {

            console.error(`Error parsing config file '${filePath}', exiting`);
            process.exit(1);

        }

        callback(data);

    });

}
