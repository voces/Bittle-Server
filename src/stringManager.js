
"use strict";

const fs = require("fs");

function addLanguage(err, file) {

    let json = JSON.parse(file.toString()),
        language = new Language();

    for (let string in json)
        if (json.hasOwnProperty(string))
            language._addString(string, json[string]);

    this.stringManager.languages[this.language] = language;

}

class Language {

    _addString(name, arr) {

        this[name] = this._string.bind(arr);

    }

    _string() {

        let s = "",
            max = Math.max(arguments.length, this.length);

        for (let i = 0; i < max; i++)
            s += (this[i] || "") + (arguments[i] || "");

        return s;

    }

}

class StringManager {

    constructor() {

        this.languages = {};

        this.count = 0;

        fs.readdir("src/strings", (err, files) => {

            for (let i = 0; i < files.length; i++) {
                let parts = files[i].split("."),
                    fileType = parts.pop(),
                    language = parts.join(".");

                if (fileType === "json") {
                    this.count++;

                    fs.readFile("src/strings/" + files[i], addLanguage.bind({stringManager: this, language: language}));
                }

            }

        });

    }

}

module.exports = new StringManager().languages;
