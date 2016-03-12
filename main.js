"use strict";

//Wrap console statements with timestamps and colors
require("console-stamp")(console, {
        pattern: "dd/mm/yyyy HH:MM:ss.l",
        colors: {
            stamp: "yellow",
            label: "white"
        }
});

const deepFreeze = require("deep-freeze-strict"),
    // repl = require("repl"),

    db = require("./src/database"),
    server = require("./src/server");

//Load the config file and return it as a JSON object
require("./src/config")(config => {

    //Freeze the config; make it is static forever
    deepFreeze(config);

    //Launch the database and connect to it
    db.start(config.database);

    //Start listening for connections
    server.start(config.server);

    // db.on("processError", e => eventLayer("dbProcessError", e));
    // db.on("connectError", e => eventLayer("dbConnectError", e));
    // db.on("ready", e => eventLayer("dbReady", e));

    //Drop into REPL
    // repl.start("> ");

});

module.exports = {
    db: db,
    server: server
}
