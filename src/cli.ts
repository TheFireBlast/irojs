#!/usr/bin/env node

import * as fs from "fs";
import { parse, compile, IroError, nodes, getParser } from "./index";
import * as chalk from "chalk";
import { Command, InvalidOptionArgumentError } from "commander";
import * as path from "path";
import { prettyError } from "./utils";

//TODO: automate this
// prettier-ignore
const validTargets: { [target: string]: string[] } = {
        "none":             [],
        "textmate":         ["textmate.xml"],
        "textmate.*":       ["textmate.json", "textmate.xml"],
        "textmate.json":    ["textmate.json"],
        "textmate.xml":     ["textmate.xml"],
        "ace":              ["ace.js"],
        "ace.*":            ["ace.js", "ace.json"],
        "ace.js":           ["ace.js"],
        "ace.json":         ["ace.json"],
        "ast":              ["ast"],
    };
validTargets["tm"] = validTargets["textmate"];
validTargets["tm.json"] = validTargets["textmate.json"];
validTargets["tm.xml"] = validTargets["textmate.xml"];
validTargets["*"] = validTargets["all"] = [...validTargets["textmate.*"], ...validTargets["ace.*"]];

type IroCompileOptions = { targets: string; out?: string; name?: string };

export function createCommand(exitOnFail = false) {
    const program = new Command();
    program
        .name("iro")
        .description("A language grammar generator for syntax highlighters")
        .version(require("../package.json").version, "-v, --version")
        .showSuggestionAfterError();
    program
        .command("compile")
        .argument("<source>")
        .requiredOption("-t, --targets <targets>", "A comma-separated list of targets")
        .option("-o, --out <path>", "The output directory (defaults to source directory)")
        .option("-n, --name <name>", "Set the output files' name (defaults to name defined in grammar)")
        .action((f, options: IroCompileOptions) => {
            const sourcePath = f;
            const targets = options.targets
                .replace("=", "")
                .split(",")
                .map((t) => {
                    var tt = validTargets[t];
                    if (!tt) console.error(`${chalk.yellow("warning")}: Skipping unknown target '${t}'`);
                    return tt;
                })
                .flat(1)
                .filter((t) => t);
            const outputPath = options.out || path.dirname(sourcePath);
            const input = fs.readFileSync(sourcePath, "utf8");
            fs.mkdirSync(outputPath, { recursive: true });

            console.log("Targets: " + targets.join(", ") + "\n");

            const start = process.hrtime();
            const result = compile(input);
            const took = (process.hrtime(start)[1] / 1e6).toFixed(3) + " ms";

            const lines = input.split("\n");
            for (let error of result.errors) {
                console.log(prettyError(error, lines, path.basename(sourcePath)));
            }

            if (result.errors.find((e) => e.fatal)) {
                console.log("\n" + chalk.red("Compilation failed"));
                if (exitOnFail) process.exit(1);
            } else {
                const grammarName = options.name || result.global.get("name")?.expanded || path.basename(sourcePath);
                const writeOutput = (suffix: string, data: any, stringify = false) =>
                    fs.writeFileSync(
                        path.join(outputPath, grammarName + suffix),
                        stringify ? JSON.stringify(data, null, 4) : data,
                        "utf8"
                    );
                for (let t of targets) {
                    switch (t) {
                        case "ast":
                            writeOutput(".ast.json", result.ast, true);
                            break;
                        case "textmate.json":
                            writeOutput(".tmlanguage.json", result.textmate, true);
                            break;
                        case "textmate.xml":
                            writeOutput(".tmlanguage", result.makeTextmateXML());
                            break;
                        case "ace.json":
                            writeOutput(".ace.json", result.ace, true);
                            break;
                        case "ace.js":
                            writeOutput(".ace.js", result.makeAceHighlighter({ spacing: 4 }));
                    }
                }
                console.log("\nCompiled successfully in " + took);
            }
        });

    return program;
}
