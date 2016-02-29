"use strict";
// const spawn = require("child_process").spawn;

require("console-stamp")(console, {
        pattern: "dd/mm/yyyy HH:MM:ss.l",
        colors: {
            stamp: "yellow",
            label: "white"
        }
});

const deepFreeze = require("deep-freeze-strict"),

    db = require("./src/database"),
    server = require("./src/server");

let config;

    // Database = require("./Database/Database.js")

require("./src/config")((data) => {

    //Replace config with a JSON object
    config = data;

    //Freeze the config; make it is static forever
    deepFreeze(config);

    //Launch the database and connect to it
    db.start(config.database);

    //Start listening for connections
    server.start(config.server);

});
