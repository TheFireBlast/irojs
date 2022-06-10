export interface NearleyError {
    message: string;
    offset: number;
    token?: moo.Token;
}

export function isNearleyError(err: any): err is NearleyError {
    return err && err.message && typeof err.offset == "number";
}

export const NO_LOC = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };