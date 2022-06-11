#!/usr/bin/env node

const { createCommand } = require("../dist/cli");

createCommand(true).parse();
