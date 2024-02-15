import chalk from "chalk";
import { IroError } from "./compiler";

export interface NearleyError {
    message: string;
    offset: number;
    token?: moo.Token;
}

export function isNearleyError(err: any): err is NearleyError {
    return err && err.message && typeof err.offset == "number";
}

export const NO_LOC = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };

//TODO: remove dependency on chalk?
export function prettyError(error: IroError, code: string | string[], filePath?: string) {
    if (typeof code == "string") code = code.split("\n");
    const color = chalk[error.fatal ? "red" : "yellow"];
    const {
        location: { start: s, end: e },
    } = error;
    const chunk = code.slice(s.line - 1, e.line).join("\n");
    const length = Math.max(0, e.offset - s.offset);
    const line = chunk.split("\n")[0];
    const lineNumber = s.line.toString().padStart(2, "0");
    var len = Math.max(0, Math.min(line.length - s.column, length));
    const tabCorrectionPre = (line.slice(0, s.column).match(/\t/g) || []).length;
    len += (line.slice(s.column, s.column + len).match(/\t/g) || []).length;
    const offset = s.column + tabCorrectionPre;
    const where = filePath
        ? `${chalk.blue(filePath)}:${chalk.yellow(error.location.start.line)}:${chalk.yellow(
              error.location.start.column + 1,
          )} - `
        : "";
    return `${where}${color(error.fatal ? "error" : "warning")}: ${error.message}
${chalk.inverse(lineNumber)} ${line.replace(/\t/g, "  ")}
${chalk.inverse(" ".repeat(lineNumber.length))} ${" ".repeat(offset)}${color("^" + "~".repeat(Math.max(0, len - 1)))}`;
}
