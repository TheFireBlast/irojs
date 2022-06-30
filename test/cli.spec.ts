import { expect } from "chai";
import * as fs from "fs/promises";
import * as path from "path";
import { createCommand } from "../src/cli";

const OUT_PATH = path.join(__dirname, "out");

//TODO: use in-memory fs?

const noop = () => {};
function runCLI(args: string[], output: (out: string) => void = noop) {
    const _log = console.log;
    console.log = output;

    var cli = createCommand();
    cli.parse([process.argv[0], process.argv[1], ...args]);

    console.log = _log;
}

async function cleanOutput() {
    await Promise.all(
        (await fs.readdir(OUT_PATH)).map((fname) => fs.rm(path.join(OUT_PATH, fname), { recursive: true, force: true }))
    );
}

before(async () => {
    await fs.mkdir(OUT_PATH, { recursive: true });
    await cleanOutput();
});

describe("CLI", function () {
    beforeEach(async function () {
        await cleanOutput();
    });
    it("should output all targets", async function () {
        runCLI(["compile", path.join(__dirname, "../examples/rion.iro"), "-o", OUT_PATH, "-t", "all"]);
        expect(await fs.readdir(OUT_PATH)).to.have.members(
            [
                //
                "rion.ace.js",
                "rion.ace.json",
                "rion.tmlanguage",
                "rion.tmlanguage.json",
            ],
            "expected output directory to have all target files"
        );
    });
    it("should not output files on fail", async function () {
        runCLI(["compile", path.join(__dirname, "../README.md"), "-o", OUT_PATH, "-t", "all"]);
        expect(await fs.readdir(OUT_PATH)).to.be.empty;
    });
});
