export type Node =
    | Grammar
    | Collection
    | Object
    | Attribute
    | Identifier
    | String
    | Value
    | ValueElement
    | Reference;

export interface BaseNode {
    type: string;
    loc: SourceLocation;
}
export interface SourceLocation {
    start: SourceLocationPosition;
    end: SourceLocationPosition;
}
export interface SourceLocationPosition {
    /** Starts at 1 */
    line: number;
    /** Starts at 0 */
    column: number;
    offset: number;
}

export interface Grammar extends BaseNode {
    type: "Grammar";
    body: Node[];
}
export interface Collection extends BaseNode {
    type: "Collection";
    name: Identifier;
    body: Node[];
}
export interface Object extends BaseNode {
    type: "Object";
    name?: Identifier;
    kind: Identifier;
    body: Node[];
    inline: boolean;
}
export type Attribute = BasicAttribute | RegexAttribute | ArrayAttribute;
export interface BasicAttribute extends BaseNode {
    type: "BasicAttribute";
    name: Identifier;
    value: Value;
}
export interface RegexAttribute extends BaseNode {
    type: "RegexAttribute";
    name: Identifier;
    value: Value;
}
export interface ArrayAttribute extends BaseNode {
    type: "ArrayAttribute";
    name: Identifier;
    value: Value[];
}
export interface Identifier extends BaseNode {
    type: "Identifier";
    name: string;
}
export interface String extends BaseNode {
    type: "String";
    value: string;
}
export interface Value extends BaseNode {
    type: "Value";
    value: (ValueElement | Reference)[];
}
export interface ValueElement extends BaseNode {
    type: "ValueElement";
    value: string;
}
export interface Reference extends BaseNode {
    type: "Reference";
    name: Identifier;
}
