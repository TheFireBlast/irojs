import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { parse, compile, IroError, nodes, NearleyError } from "../dist/index";

function testFile(file: string) {
    describe(file, function () {
        var input = fs.readFileSync(path.join(__dirname, file), "utf8");
        var ast!: nodes.Grammar;
        it("should parse", function () {
            expect(() => (ast = parse(input))).to.not.throw();
        });
        var compiled!: ReturnType<typeof compile>;
        it("should compile", function () {
            if (!ast) return this.skip();
            compiled = compile(ast, {
                textmate: true,
                ace: true,
            });
            expect(compiled.errors, "expected no errors").to.be.empty;
        });
        // if (compiled?.errors.length > 0) {
        //     console.log(compiled.errors);
        // }
    });
}

describe("Grammars", function () {
    //TODO: glob
    testFile("sample.iro");
    testFile("rion.iro");
    testFile("redlapis.iro");
});

// describe("CLI", function() {

// })