"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),

    // Request = require("./Request"),

    PERMISSIONS = ["owner", "manager", "contributor", "observer", "none"];

function findLine(file, lineId) {

    for (let i = 0; i < file.lines.length; i++)
        if (file.lines[i].lineId === lineId) {
            if (i > 5) {
                file.lines.unshift(file.lines.splice(i, 1));
                i = 0;
            }
            return file.lines[i];
        }

    return null;

}

class Repo extends EventEmitter {

    constructor(server, repo) {
        super();

        this.server = server;
        this.name = repo;

        this.listeners = [];

        this.roles = {};
        this.files = {};

        this.get();
    }

    exists() {

        return this.wait(resolve => resolve(this.db ? true : false));

    }

    create(owner) {

        return this.wait((resolve, reject) => {

            if (this.db !== null) return reject("Name is already taken.");

            Promise.all([
                this.server.db.repoCreate(this.name),
                this.server.db.roleSet(owner, this.name, "owner")

            ]).then(() => {

                this.log(`Repo '${this.name}' created, '${owner}' is owner`);

                this.get();
                this.roles[owner.toLowerCase()] = "owner";
                this.listeners.push(owner);

                resolve();

            });

        });

    }

    getRole(user) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            let lowerUser = user.toLowerCase();

            if (typeof this.roles[lowerUser] !== "undefined") return resolve(this.roles[lowerUser]);

            this.server.db.roleGet(user, this.name).then(role => {

                if (role === null) this.roles[lowerUser] = "none";
                else this.roles[lowerUser] = role.role;

                resolve(this.roles[lowerUser]);

            });

        });

    }

    setRole(setter, setterRole, receiver, newRole) {

        if (PERMISSIONS.indexOf(newRole) < 0)
            return new Promise((resolve, reject) => reject("Role does not exist."));

        if (PERMISSIONS.indexOf(newRole) < PERMISSIONS.indexOf(setterRole))
            return new Promise((resolve, reject) => reject("Not enough permission."));

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            Promise.all([
                this.server.db.userGet(receiver),
                this.getRole(receiver)

            ]).then(result => {

                let user = result[0][0],
                    currentRole = result[1];

                if (!user) return reject("User does not exist.");

                if (currentRole && PERMISSIONS.indexOf(currentRole) <= PERMISSIONS.indexOf(setterRole))
                    return reject("User has equal or greater role.");

                if (currentRole === "none" && newRole === "none")
                    return reject("User does not have any role.");

                this.server.db[newRole === "none" ? "roleDelete" : "roleSet"](receiver, this.name, newRole).then(() => {
                    this.log(`Role of '${receiver}' changed to '${newRole}' by '${setter.name}'`);
                    this.roles[receiver.toLowerCase()] = newRole;
                    resolve();

                });

            });

        });

    }

    getFile(filePath) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            filePath = filePath.replace(/\\/g, "/");

            if (typeof this.files[filePath.toLowerCase()] === "undefined")

                this.server.db.fileGet(this.name, filePath).then(file => {

                    this.files[filePath.toLowerCase()] = file;
                    resolve(file);

                }, (/*error*/) => {

                    this.files[filePath.toLowerCase()] = null;
                    resolve(null);

                });

            else resolve(this.files[filePath.toLowerCase()]);

        });

    }

    createFile(filePath, initialLineId) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            filePath = filePath.replace(/\\/g, "/");

            this.getFile(filePath).then(file => {

                if (file !== null) return reject("File already exists.");

                this.log(`File '${filePath}' created inside repo '${this.name}'`);

                this.server.db.fileCreate(this.name, filePath, initialLineId).then(() => {
                    delete this.files[filePath];
                    this.getFile(filePath);
                    resolve();

                }).catch(error => this.error(error));

            }, error => reject(error));

        });

    }

    moveFile(oldPath, newPath) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            oldPath = oldPath.replace(/\\/g, "/");
            newPath = newPath.replace(/\\/g, "/");

            Promise.all([
                this.getFile(oldPath),
                this.getFile(newPath)

            ]).then(result => {

                let oldFile = result[0],
                    newFile = result[1];

                if (oldFile === null) return reject("File does not exist.");
                if (newFile !== null) return reject("File already exists.");

                this.log(`File '${oldFile}' moved to '${newFile}' inside repo '${this.name}'`);

                this.server.db.fileMove(this.name, oldPath, newPath).then(() => resolve());

            });

        });

    }

    deleteFile(filePath) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            filePath = filePath.replace(/\\/g, "/");

            this.getFile(filePath).then(file => {

                if (file === null) return reject("File does not exist.");

                this.log(`File '${oldFile}' deleted from repo '${this.name}'`);

                this.server.db.fileDelete(this.name, filePath).then(() => {
                    this.files[filePath] = null;
                    resolve();

                });

            }, error => reject(error));

        });

    }

    getLine(filePath, lineId) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) reject("File does not exist.");

            let line = findLine(this.file, lineId);

            if (!line) reject("Line does not exist.");

            resolve({
                line: line.line,
                previous: line.previous,
                next: line.next,
                lineId: lineId
            });

        });

    }

    insert(filePath, lineId, column, data) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) reject("File does not exist.");

            let line = findLine(this.file, lineId);

            if (!line) reject("Line does not exist.");

            line.line = line.line.slice(0, column) + data + line.line.slice(column);

            this.server.db.lineSet(this.name, filePath, lineId, line.line).then(() => resolve());

        })

    }

    get() {

        this.retrieved = false;

        this.server.db.repoGet(this.name).then(repo => {
            this.db = repo;
            this.emit("retrieve", this);
            this.retrieved = true;
        });

    }

    waitFile(filePath, promiseCallback) {

        return new Promise((resolve, reject) => this.getFile(filePath).then(file => {
            this.file = file;
            new Promise(promiseCallback).then(
                result => resolve(result),
                error => reject(error)
            );
        }, error => reject(error)));

    }

    wait(promiseCallback) {

        if (this.retrieved) return new Promise(promiseCallback);

        return new Promise((resolve, reject) => this.once("retrieve", () => new Promise(promiseCallback).then(
            innerResolve => resolve(innerResolve),
            innerReject => reject(innerReject)
        )));

    }

    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.blue(`[${this.name}]`), ...arguments]);
        /*eslint-enable no-console*/

    }

    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.blue(`[${this.name}]`), ...arguments]);
        /*eslint-enable no-console*/

    }

}

module.exports = Repo;
