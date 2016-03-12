
"use strict";

class Tester {

    constructor(tests, context) {

        this.passed = [];
        this.failed = [];
        this.tests = [];

        this.timer = null;

        for (let item in context)
            this[item] = context[item];

        for (let i = 0; i < tests.length; i++)
            this.tests.push(this.newTest(...tests[i]))

    }

    newTest(message, action, callback) {

        return new Test(message, action, callback);

    }

    start() {

        if (this.tests.length) this.doNextTest();

    }

    doNextTest() {

        this.tests[0].output = document.createElement("div");
        this.tests[0].output.innerHTML = this.tests[0].message;

        document.body.appendChild(this.tests[0].output);

        this.tests[0].action();

        this.timer = setTimeout(this.timeout.bind(this), 3000);

    }

    timeout() {

        this.fail();

        if (this.tests[0]) this.doNextTest();
        else this.printResults();

    }

    fail() {

        let test = this.tests.splice(0, 1)[0];

        test.output.innerHTML = "Fail --- " + test.output.innerHTML;

        this.failed.push(test);

    }

    pass() {

        let test = this.tests.splice(0, 1)[0];

        test.output.innerHTML = "Pass --- " + test.output.innerHTML;

        this.passed.push(test);

    }

    event(event) {

        clearTimeout(this.timer);

        let pass = this.tests[0].finish(event);

        if (pass === "more") {
            this.timer = setTimeout(this.timeout.bind(this), 2000);
            return;
        }

        if (pass) this.pass();
        else this.fail();

        if (this.tests[0]) this.doNextTest();
        else this.printResults();

    }

    printResults() {

        let total = this.passed.length + this.failed.length,
            percent = (this.passed.length / total * 100).toFixed(2),
            p = document.createElement("p");

        p.textContent = `${this.passed.length}/${total} (${percent}%) tests passed.`;

        document.body.appendChild(p);

    }

}
