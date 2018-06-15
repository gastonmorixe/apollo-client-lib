#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var package_json_1 = require("../../package.json");
var program = require("commander");
var debug = require("debug");
var d = debug("danger:runner");
d("argv: " + process.argv);
// Provides the root node to the command-line architecture
program
    .version(package_json_1.version)
    .command("run", "Runs danger on your local system", { isDefault: true })
    .command("pr", "Runs your changes against an existing PR")
    .parse(process.argv);
//# sourceMappingURL=danger.js.map