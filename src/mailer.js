
"use strict";

const nodemailer = require("nodemailer");

class Mailer {

    setup(name, service, user, pass) {

        this.name = name;
        this.from = user;

        this.transporter = nodemailer.createTransport({
            service: service,
            auth: {
                user: user,
                pass: pass
            }
        });

    }

    send(to, subject, text, html) {

        return new Promise((resolve, reject) => {

            this.transporter.sendMail({
                from: `${this.name} <${this.from}>`,
                to: to,
                subject: subject,
                text: text,
                html: html

            }, (err, success) => {

                if (err) return reject(err);

                resolve(success);

            });

        });

    }

}

let mailer = new Mailer(),
    initialized = false;

module.exports = (config) => {

    if (typeof config !== "undefined" && !initialized) {

        let name = config.name || "Bittle",
            service = config.service || "Gmail",

            user, pass;

        if (config.userEval) user = eval(config.user);
        else user = config.user || "";

        if (config.passEval) pass = eval(config.pass);
        else pass = config.pass || "";

        mailer.address = config.address;

        mailer.setup(name, service, user, pass);

    }

    return mailer.send.bind(mailer);

};
