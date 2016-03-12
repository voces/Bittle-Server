
//Test functions referenced by other functions?
//Test event handlers internally?
//Test database changes?

"use strict";

const tape = require("tape");

let bittle;

tape("Initialization", {timeout: 5000}, test => {
    test.plan(3);

    test.doesNotThrow(() => {
        bittle = require("./main");
    });

    bittle.db.on("ready", () => test.equal(true, true));
    bittle.server.on("wsstart", () => test.equal(true, true));

});

// tape("Config", test => {
//
//     test.equal("tests work", "tests work");
//     test.equal("tests work", "tests don't work");
//
// });
//
// tape("Database", test => {
//
//     t.plan(1);
//
//     bittle.db.on("ready", () => {
//         test.
//     })
//     test.equal("tests work", "tests work");
//     test.equal("tests work", "tests don't work");
//
// });
