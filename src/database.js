
"use strict";

class MongoDB {

    constructor(config) {

        this.config = config;

        /********
         *  Spawn a mongodb process, store it at this.process
         */

        console.log(`Running 'mongod${(config.args ? " " + config.args : "")}'`);

        const spawn = require("child_process").spawn;

        //Run mongodb and pass any arguments
        this.process = spawn("mongod", config.args.split(" "));

        //Capture the output: both general and errors
        this.process.stdout.on("data", this.processOut.bind(this));
        this.process.stderr.on("data", this.processErr.bind(this));

    }

    processOut(data) {

        //Data comes in as a buffer, convert to string
        data = data.toString();

        //Capture the line that indicates what port MongoDB is on
        if (data.indexOf("waiting for connections on port") >= 0) {

            //Grab that port
            this.port = data.slice(data.indexOf("port") + 5).split(/\D/)[0];

            console.log(`Found mongod on port '${this.port}'`);

            //Theoretically disable this listener, but this is not how you do it
            //  TODO: fix me
            this.process.stdout.removeListener("data", this.processOut);

            //We can now connect to our mongo database
            this.connectToMongo();

        }

    }

    processErr(data) {
        console.error("mongoErr", data.toString());
    }

    connectToMongo() {

        if (typeof this.db !== "undefined") return;
        this.db = true;

        /********
         *  Connect to mongodb
         */

         //Build up the address of the database
         this.url = `mongodb://localhost:${this.port}/${this.config.database}`;

         console.log(`Connecting to mongod at '${this.url}'`);

        const MongoClient = require('mongodb').MongoClient;

        //Connect to it
        MongoClient.connect(this.url, (err, db) => {

            //If any errors occur, kill the server and database processes
            if (err) {

                console.error(`Error connecting to mongodb at '${this.url}', exiting`)
                process.exit(1);

            }

            console.log(`Connected to mongod at '${this.url}'`);

            this.db = db;

        })

    }

    userCreate(name, password, salt, email) {}
    userGet(name) {}
    userSetPassword(name, password, salt) {}
    userSetEmail(name, email) {}

    repoCreate(name, parent) {}
    repoGet(name) {}
    // repoDelete(name) {}

    permSet(user, repo, permission) {}
    permGet(user, repo) {}
    permRemove(user, repo) {}

    dirCreate(repo, parent, name) {}
    dirGet(repo, parent, name) {}
    dirDelete(repo, parent, name) {}

    fileCreate(directory, name) {}
    fileMove(oldDirectory, name, newDirectory) {}
    fileDelete(directory, name) {}
    fileGet(directory, name) {}

    fileGetLines(directory, name) {}

    lineSet(file, lineId, value) {}
    lineGet(file, lineId) {}
    lineRemove(file, lineId) {}

}

//Force a singleton database
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

        },

        //Key is name
        userCreate: db.userCreate,
        userGet: db.userGet,
        userSetPassword: db.userSetPassword,
        userSetEmail: db.userSetEmail,

        //Key is name
        repoCreate: db.repoCreate,
        repoGet: db.repoGet,
        // repoDelete: db.repoDelete,

        //Key is {user, repo}
        permSet: db.permSet,
        permGet: db.permGet,
        permRemove: db.permRemove,

        //Key is {repo, parent, name}
        dirCreate: db.dirCreate,
        dirGet: db.dirGet,
        dirDelete: db.dirDelete,

        //Key is {directory, name}
        fileCreate: db.fileCreate,
        fileMove: db.fileMove,
        fileDelete: db.fileDelete,
        fileGet: db.fileGet,

        fileGetLines: db.fileGetLines,

        //Key is {file, lineId}
        lineSet: db.lineSet,
        lineGet: db.lineGet,
        lineRemove: db.lineRemove

    };

}();
