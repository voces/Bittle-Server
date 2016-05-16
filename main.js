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
    server.start(config.server, db);

    // db.on("processError", e => eventLayer("dbProcessError", e));
    // db.on("connectError", e => eventLayer("dbConnectError", e));
    // db.on("ready", e => db.);

    //Drop into REPL
    // repl.start("> ");

});

//For input
let input = process.openStdin();

//Attach input listener
input.addListener("data", d => {
    try {

        /*eslint-disable no-console, no-eval*/
        console.log(eval(d.toString().substring(0, d.length - 2)));
        /*eslint-enable no-console, no-eval*/

    } catch (err) {

        /*eslint-disable no-console*/
        console.error(err);
        /*eslint-enable no-console*/
        
    }
});

module.exports = {
    db: db,
    server: server
};
