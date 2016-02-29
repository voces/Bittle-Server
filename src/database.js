
"use strict";

class MongoDB {

    constructor(config) {

        this.config = config;

        /********
         *  Spawn a mongodb process, store it at this.process
         */

        console.log(`Running 'mongod${(config.args ? " " + config.args : "")}'`);

        const spawn = require("child_process").spawn;

        this.process = spawn("mongod", config.args.split(" "));

        this.process.stdout.on("data", this.processOut.bind(this));
        this.process.stderr.on("data", this.processErr.bind(this));

    }

    connectToMongo() {

        if (typeof this.db !== "undefined") return;
        this.db = true;

        /********
         *  Connect to mongodb
         */

         this.url = `mongodb://localhost:${this.port}/${this.config.database}`;

         console.log(`Connecting to mongod at '${this.url}'`);

        const MongoClient = require('mongodb').MongoClient;

        MongoClient.connect(this.url, (err, db) => {

            if (err) {

                console.error(`Error connecting to mongodb at '${this.url}', exiting`)
                process.exit(1);

            }

            console.log(`Connected to mongod at '${this.url}'`);

            this.db = db;

        })

    }

    processOut(data) {

        data = data.toString();

        if (data.indexOf("waiting for connections on port") >= 0) {

            this.port = data.slice(data.indexOf("port") + 5).split(/\D/)[0];

            console.log(`Found mongod on port '${this.port}'`);

            this.process.stdout.removeListener("data", this.processOut);

            this.connectToMongo();

        }

    }

    processErr(data) {
        console.error("mongoErr", data.toString());
    }

}

module.exports = () => {

    let db;

    return {

        start: config => {

            //Only allow one database
            if (typeof db !== "undefined") return;

            //Could theoretically route different databases, but we're just programming for MongoDB
            switch (config.type) {

                case "mongodb":
                    db = new MongoDB(config);
                    break;

            }

        }
    };

}();
