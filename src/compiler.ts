import type * as N from "./nodes";
import { CompiledAttribute, Scope, ScopeManager } from "./ScopeManager";
import js2plist from "plist2/js2plist";

const validGlobalAttributes = [
    "background_color",
    "color",
    "description",
    "file_extensions",
    "first_line_match",
    "folding_end_marker",
    "folding_start_marker",
    "name",
    "secondary_theme_background_color",
    "secondary_theme_color",
    "selected_theme",
    "textmate_compatible",
    "textmate_scope_override",
    "textmate_uuid",
];
const validRegexAttribute = /^(?:\^|\\b|\\B)?(\(.*?\))+(?:\$|\\b|\\B)?$/;
const EOL_REGEX = "(^(?=.{0,1})(?:|))";
const NO_LOC = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } };

export interface IroError {
    message: string;
    location: N.SourceLocation;
    fatal: boolean;
}

export interface TMGrammar {
    name: string;
    scopeName: string;
    firstLineMatch?: string;
    foldingStartMarker?: string;
    foldingStopMarker?: string;
    fileTypes?: string[];
    patterns: TMPattern[];
    repository?: {
        [s: string]: {
            patterns: TMPattern[];
        };
    };
}
export interface TMCaptures {
    [k: string]: { name: string };
}
export interface TMPatternSimple {
    name: string;
    match: string;
}
export interface TMPatternCompound {
    match: string;
    captures: TMCaptures;
}
export interface TMPatternComplex {
    begin: string;
    end: string;
    contentName?: string;
    beginCaptures: TMCaptures;
    endCaptures: TMCaptures;
    patterns?: TMPattern[];
}
export interface TMPatternInclude {
    include: string;
}
export type TMPattern = TMPatternSimple | TMPatternCompound | TMPatternComplex | TMPatternInclude;

export interface AceGrammar {
    name: string;
    rules: {
        [s: string]: AcePattern[];
    };
}
export interface AcePatternGeneral {
    token: string | string[];
    regex: string;
    next?: string;
    push?: string;
}

export interface AcePatternDefaultToken {
    defaultToken: string;
}
export interface AcePatternInclude {
    include: string;
}
export type AcePattern = AcePatternGeneral | AcePatternDefaultToken | AcePatternInclude;

export interface Style {
    name: string;
    color?: string;
    textmate: string;
    ace: string;
}

function isAttribute(node: N.Node): node is N.Attribute {
    return node.type == "BasicAttribute" || node.type == "ArrayAttribute" || node.type == "RegexAttribute";
}

function getNamedNode<T extends (N.Node & { name: N.Identifier })["type"]>(
    name: string,
    type: T,
    array: N.Node[]
): N.Node & { type: T } {
    return array.find((n) => n.type == type && (n as any)["name"].name == name) as any;
}

/**
 * @returns the number of subgroups in each capture group
 */
function getRegexGroups(regex: string) {
    var list: number[] = [];
    var captures = 1;
    var depth = 0;
    for (let i = 0; i < regex.length; i++) {
        let c = regex[i];
        if (c == "\\") {
            i++;
        } else if (c == "(") {
            if (depth > 0) captures++;
            depth++;
        } else if (c == ")" && --depth == 0) {
            list.push(captures);
            captures = 1;
        }
    }
    return list;
}

export interface CompileOptions {
    /**Compilation targets */
    targets: ("textmate" | "ace")[];
    /**Emit default token when compiling to ace */
    aceDefaultToken: boolean;
}

export function compile(ast: N.Grammar, _options?: Partial<CompileOptions>) {
    var options: CompileOptions = Object.assign(
        <CompileOptions>{
            targets: [],
            aceDefaultToken: true,
        },
        _options
    );

    //TODO: selective compilation
    //  a possible but slow solution is to have a separate pass for each grammar target
    const TEXTMATE = options.targets.includes("textmate");
    const ACE = options.targets.includes("ace");

    var tmGrammar: TMGrammar = {
        name: "",
        scopeName: "",
        patterns: [{ include: "#main" }],
        repository: {},
    };
    var aceGrammar: AceGrammar = {
        name: "",
        rules: {},
    };
    var errors: IroError[] = [];
    var scopes = new ScopeManager();
    var inclusions: Map<string, string[]> = new Map();

    function checkRecursion(stack: string[]): string[] | null {
        if (stack.length > 10) return [...stack.slice(0, 5), "[...]"];
        if (stack[0] == stack[1]) return stack;

        var targetName = stack[stack.length - 1];
        var target = inclusions.get(targetName);
        if (!target) return null;
        for (var subTarget of target) {
            var _stack = [...stack, subTarget];
            if (stack.includes(subTarget)) return _stack;
            var res = checkRecursion(_stack);
            if (res) return res;
        }
        return null;
    }
    /**
     * Pushes an error or warning to the error list
     */
    function err(message: string, location: IroError["location"], fatal: boolean) {
        errors.push({ message, location, fatal });
    }
    /**
     * Checks if the attribute exists and pushes an error otherwise
     * @param name The name of the attribute
     * @param type The attribute's type
     * @param node The attribute's parent node
     * @returns returns the attribute if it exists
     */
    function mandatory<T extends N.Attribute["type"]>(name: string, type: T, node: N.Object) {
        var attr = getNamedNode(name, type, node.body);
        if (attr) return attr;
        else return err(`Could not find mandatory attribute '${name}'`, node.loc, true);
    }
    var styles = new Map<string, Style>();
    function getStyle(name: string, node: N.Value) {
        var s = styles.get(name);
        if (s) return s;
        else err(`Could not find style '${name}'`, node.loc, true);
    }
    var currentCollection: string;
    var currentTMContext: TMPatternComplex & { patterns: TMPattern[] };
    var currentAceRule: string;

    /**
     * Creates an ace subrule
     * @param rule The name of the rule
     * @returns The name of the subrule
     */
    function aceSubRule(rule: string) {
        rule = rule.replace(/__\d+$/, "");
        var i = 1;
        var newRule: string;
        do {
            newRule = rule + "__" + i++;
        } while (aceGrammar.rules[newRule]);
        aceGrammar.rules[newRule] = [];
        return newRule;
    }

    var expandStack: N.Attribute[] = [];
    /**
     * @returns the attribute value with expanded constants
     */
    function expand(attr: N.Attribute): string {
        if (expandStack.includes(attr)) {
            let trace = "";
            for (let s of expandStack) trace += scopes.get(s.name.name)?.fullName + " → ";
            trace += scopes.get(attr.name.name)?.fullName;
            err(`Cyclic reference detected (${trace})`, attr.loc, true);
            return "";
        }
        expandStack.push(attr);
        var out: string;
        if (attr.type == "RegexAttribute" || attr.type == "BasicAttribute") {
            out = "";
            for (let val of attr.value.value) {
                if (val.type == "Reference") {
                    var ref = scopes.get(val.name.name);
                    if (!ref) {
                        err(`Attribute '${val.name.name}' does not exist`, val.name.loc, true);
                        expandStack.pop();
                        return "";
                    }
                    if (ref.type == "ArrayAttribute") {
                        err(`Unexpected reference to array attribute ${ref.fullName}`, val.loc, true);
                        expandStack.pop();
                        return "";
                    }
                    // console.log("%s -> %s", scopes.getPath() + attr.name.name, ref.fullName || `'${ref}'`);
                    // console.log("->", ref.source);
                    if (ref.isExpanded) {
                        out += ref.expanded;
                    } else {
                        let exp = expand(ref.source);
                        (scopes.get(ref.name) as CompiledAttribute).expanded = exp;
                        out += exp;
                    }
                } else {
                    out += val.value;
                }
            }
        } else {
            expandStack.pop();
            throw "Unexpected attribute type " + attr.type;
        }
        expandStack.pop();
        return out;
    }
    /**
     * Registers attributes into the current scope
     * @param body Node to find attributes in
     */
    function registerAttributes(body: N.Node[]) {
        // Attribute Declaration
        for (let node of body) {
            if (isAttribute(node)) {
                let { name } = node.name;
                if (
                    scopes.current == scopes.global &&
                    !name.startsWith("__") &&
                    !validGlobalAttributes.includes(name)
                ) {
                    throw new Error(`Unexpected attribute '${name}'`);
                }
                if (scopes.current.has(name)) err(`Duplicate attribute '${name}'`, node.loc, true);
                else scopes.set(name, node);
            }
        }
        // Attribute Expansion
        for (let node of body) {
            if (isAttribute(node)) {
                if (node.type == "ArrayAttribute") {
                    let out = [];
                    for (let element of node.value) {
                        out.push(
                            expand({
                                type: "BasicAttribute",
                                name: node.name,
                                value: element,
                                loc: element.loc,
                            }) as string
                        );
                    }
                    (scopes.get(node.name.name) as CompiledAttribute).expanded = out;
                } else (scopes.get(node.name.name) as CompiledAttribute).expanded = expand(node);
            }
        }
    }
    //TODO: make optional in config
    function enforceDotPrefix(styleList: [string, N.Value][]) {
        for (let s of styleList) {
            if (s[0][0] != ".") {
                err(`Type identifiers must start with a dot. Did you mean to write '.${s[0]}'?`, s[1].loc, false);
                s[0] = "." + s[0];
            }
        }
    }
    /**
     * Checks whether the value of a regex attribute is valid
     */
    function validateRegex(regex: string, loc: N.SourceLocation) {
        if (!validRegexAttribute.test(regex)) {
            err(`'${regex}' does not match the regular expression ${validRegexAttribute}`, loc, true);
            return false;
        } else {
            try {
                new RegExp(regex);
                return true;
            } catch (e: any) {
                err(e.message || "Invalid regular expression", loc, true);
                return false;
            }
        }
    }
    function validateRegexAndStyleList(
        regex: string,
        regexLoc: N.SourceLocation,
        styleList: [string, N.Value][],
        stylesLoc: N.SourceLocation
    ) {
        if (validateRegex(regex, regexLoc)) {
            // The number of styles must either
            // match the total number of regex capture groups eg. (a(b))(c(d(e))) -> 5
            // or the number of top groups eg. (a(b))(c(d(e))) -> 2
            let groups = getRegexGroups(regex);
            let totalGroups = groups.reduce((a, b) => a + b);
            // If there are only styles for the top groups, populate the style list
            if (styleList.length == groups.length && groups.length != totalGroups) {
                let newList: typeof styleList = [];
                for (let i = 0; i < styleList.length; i++) {
                    for (let j = 0; j < groups[i]; j++) newList.push(styleList[i]);
                }
                // Replace the styles array but keeping reference
                styleList.splice(0, styleList.length, ...newList);
            }
            // Otherwise, if there's a mismatch, throw an error
            else if (styleList.length != totalGroups) {
                err("Number of styles and regexp groups doesn't match", stylesLoc, true);
            }
        }

        enforceDotPrefix(styleList);
    }

    /**
     * Traverses through an ast to generate grammars
     */
    function traverse(node: N.Node) {
        if (node.type == "Grammar") {
            registerAttributes(node.body);
            if (scopes.global.has("name")) {
                let name = scopes.global.get("name") as CompiledAttribute;
                tmGrammar.name = name.expanded as string;
                tmGrammar.scopeName = "source." + tmGrammar.name;
                aceGrammar.name = name.expanded as string;
                aceGrammar.name = aceGrammar.name[0].toUpperCase() + aceGrammar.name.toLowerCase().slice(1);
            } else err("Could not find mandatory attribute 'name'", NO_LOC, true);
            if (scopes.global.has("file_extensions")) {
                tmGrammar.fileTypes = (scopes.global.get("file_extensions") as any).expanded as string[];
            }
            // Styles are registered first
            let stylesCollection = node.body.find((n) => n.type == "Collection" && n.name.name == "styles");
            if (stylesCollection) traverse(stylesCollection);
            else err("Could not find mandatory collection 'styles'", NO_LOC, true);
            if (!node.body.find((n) => n.type == "Collection" && n.name.name == "contexts"))
                err("Could not find mandatory collection 'contexts'", NO_LOC, true);

            for (let n of node.body) {
                if (n.type == "Collection" && n.name.name == "contexts") {
                    // Register includes to detect cyclic references
                    for (let c of n.body) {
                        if (c.type == "Object" && c.kind.name == "context" && c.name) {
                            let includeList = c.body.filter(
                                (n) => n.type == "Object" && n.kind.name == "include"
                            ) as N.Object[];
                            let targets = includeList.map((n) => (n.body[0] as N.String).value);
                            inclusions.set(
                                c.name.name,
                                targets.filter((t, i) => targets.indexOf(t) == i)
                            );
                        }
                    }
                }
                if (!isAttribute(n) && n != stylesCollection) traverse(n);
            }
        } else if (node.type == "Collection") {
            if (scopes.current != scopes.global) return err(`Nested collections are not allowed`, node.loc, true);
            let { name } = node.name;
            if (name == "styles" || name == "contexts") {
                if (scopes.push(name) === false) {
                    return err(`Duplicate collection '${name}'`, node.name.loc, true);
                }
                for (let n of node.body) {
                    if (name == "styles" && n.type == "Object" && n.name && n.name.name[0] != ".") {
                        err(
                            `Type identifiers must start with a dot. Did you mean to write '.${n.name.name}'?`,
                            n.name.loc,
                            false
                        );
                        n.name.name = "." + n.name.name;
                    }
                    currentCollection = name;
                    traverse(n);
                }
                scopes.pop();
            } else err(`Unexpected collection '${name}'`, node.name.loc, false);
        } else if (node.type == "Object") {
            let name = node.name?.name;
            let kind = node.kind.name;
            // If we are on the top/global scope
            if (!scopes.current.parent) {
                let errorMessage = `Unexpected global object ${name ? `'${name}'` : ""}`;
                if (kind == "context" || kind == "pattern")
                    errorMessage += ". Did you mean to place it inside collection 'contexts'?";
                if (kind == "pattern") errorMessage += ". Did you mean to place it inside object 'main'?";
                if (kind == "style") errorMessage += ". Did you mean to place it inside collection 'styles'?";
                err(errorMessage, node.loc, true);
                return;
            }
            if (node.name?.name == "__proto__") {
                err("Prototype pollution", node.name.loc, true);
                return;
            }
            let s = scopes.push(name || "?" + kind);
            if (s === false) {
                err(`Duplicate object '${name}'`, node.loc, true);
                return;
            }
            registerAttributes(node.body);
            try {
                if (kind == "pattern") {
                    let regexNode = mandatory("regex", "RegexAttribute", node);
                    let stylesNode = mandatory("styles", "ArrayAttribute", node);
                    if (!regexNode || !stylesNode) return;
                    let regex = scopes.get<true>(regexNode.name.name).expanded as string;
                    let styleList: [string, N.Value][] = (
                        scopes.get<true>(stylesNode.name.name).expanded as string[]
                    ).map((v, i) => [v, stylesNode!.value[i]]);
                    validateRegexAndStyleList(regex, regexNode.loc, styleList, stylesNode.loc);

                    if (styleList.length == 1) {
                        let style = getStyle(styleList[0][0], styleList[0][1]);
                        if (style) {
                            currentTMContext.patterns.push({ name: style.textmate, match: regex });
                            aceGrammar.rules[currentAceRule].push({ token: style.ace, regex: regex });
                        }
                    } else {
                        let tmCaptures: TMCaptures = {};
                        let aceTokens: string[] = [];
                        let i = 1;
                        for (let styleInfo of styleList) {
                            let style = getStyle(styleInfo[0], styleInfo[1]);
                            if (!style) continue;
                            tmCaptures[i++] = { name: style.textmate };
                            aceTokens.push(style.ace);
                        }
                        currentTMContext.patterns.push({ match: regex, captures: tmCaptures });
                        aceGrammar.rules[currentAceRule].push({ token: aceTokens, regex: regex });
                    }
                } else if (kind == "push") {
                    //TODO: implement push
                    err(`Missing implementation for 'push', try using 'inline_push' instead`, node.kind.loc, true);
                } else if (kind == "inline_push") {
                    let invalid = false;
                    let regexNode = mandatory("regex", "RegexAttribute", node);
                    let stylesNode = mandatory("styles", "ArrayAttribute", node);
                    let defaultStyleNode = getNamedNode("default_style", "BasicAttribute", node.body);
                    if (!node.body.find((n) => n.type == "Object")) {
                        err("Please supply one or more inline list items", node.loc, true);
                        invalid = true;
                    }
                    let pop = node.body.filter(
                        (n) => n.type == "Object" && (n.kind.name == "pop" || n.kind.name == "eol_pop")
                    ) as N.Object[];
                    if (pop.length == 0) {
                        err("missing pop object", node.loc, true);
                        invalid = true;
                    }
                    if (pop.length > 1) {
                        err(
                            "too many pop objects",
                            { start: pop[1].loc.start, end: pop[pop.length - 1].loc.end },
                            true
                        );
                        invalid = true;
                    }
                    let hasNonPop = node.body.find(
                        (n) => n.type == "Object" && n.kind.name != "pop" && n.kind.name != "eol_pop"
                    );
                    if (hasNonPop && defaultStyleNode) {
                        err(
                            "Cannot set a default Style if a non-pop rule is provided or included (textmate mode)",
                            defaultStyleNode.loc,
                            true
                        );
                        invalid = true;
                    }
                    if (!hasNonPop && !defaultStyleNode) {
                        err("Please supply a default Style for this rule (textmate mode)", node.loc, true);
                        invalid = true;
                    }
                    if (regexNode && stylesNode && !invalid) {
                        let regex = scopes.get<true>(regexNode.name.name).expanded as string;
                        let styleList: [string, N.Value][] = (
                            scopes.get<true>(stylesNode.name.name).expanded as string[]
                        ).map((v, i) => [v, stylesNode!.value[i]]);
                        validateRegexAndStyleList(regex, regexNode.loc, styleList, stylesNode.loc);

                        let defaultStyle =
                            defaultStyleNode && (scopes.get<true>(defaultStyleNode.name.name).expanded as string);
                        defaultStyleNode && enforceDotPrefix([[defaultStyle, defaultStyleNode.value]]);
                        let tmPattern: any = {
                            begin: regex,
                            beginCaptures: {},
                            end: undefined,
                            endCaptures: {},
                            patterns: [],
                        };
                        let acePattern: any = {
                            token: [],
                            regex: regex,
                            push: aceSubRule(currentAceRule),
                        };
                        currentTMContext.patterns.push(tmPattern);
                        aceGrammar.rules[currentAceRule].push(acePattern);

                        let i = 1;
                        for (let styleInfo of styleList) {
                            let style = getStyle(styleInfo[0], styleInfo[1]);
                            if (!style) continue;
                            tmPattern.beginCaptures[i++] = { name: style.textmate };
                            (acePattern.token as string[]).push(style.ace);
                        }
                        if (acePattern.token.length == 1) acePattern.token = acePattern.token[0];

                        let _currentTMContext = currentTMContext,
                            _currentAceContext = currentAceRule;
                        currentTMContext = tmPattern as any;
                        currentAceRule = acePattern.push;
                        for (let n of node.body) {
                            if (!isAttribute(n)) traverse(n);
                        }
                        currentAceRule = _currentAceContext;
                        currentTMContext = _currentTMContext;
                        if (tmPattern.patterns.length == 0) delete tmPattern.patterns;
                        if (defaultStyle) {
                            let style = getStyle(defaultStyle, defaultStyleNode.value);
                            if (!style) return; //TODO: error: no styles defined
                            tmPattern.contentName = style.textmate;
                            aceGrammar.rules[acePattern.push].push({ defaultToken: style.ace });
                        }
                    }
                } else if (kind == "pop" && currentTMContext["beginCaptures"]) {
                    let regexNode = mandatory("regex", "RegexAttribute", node);
                    let stylesNode = mandatory("styles", "ArrayAttribute", node);
                    if (!regexNode || !stylesNode) return;
                    var regex = scopes.get<true>(regexNode.name.name).expanded as string;
                    let styleList: [string, N.Value][] = (
                        scopes.get<true>(stylesNode.name.name).expanded as string[]
                    ).map((v, i) => [v, stylesNode!.value[i]]);
                    validateRegexAndStyleList(regex, regexNode.loc, styleList, stylesNode.loc);

                    let tmPattern = currentTMContext as TMPatternComplex;
                    let acePattern: AcePattern = {
                        token: [],
                        regex: regex,
                        next: "pop",
                    };
                    aceGrammar.rules[currentAceRule].push(acePattern);
                    tmPattern.end = regex;

                    let i = 1;
                    for (let styleInfo of styleList) {
                        let style = getStyle(styleInfo[0], styleInfo[1]);
                        if (!style) continue;
                        tmPattern.endCaptures[i++] = { name: style.textmate };
                        (acePattern.token as string[]).push(style.ace);
                    }
                    if (acePattern.token.length == 1) acePattern.token = acePattern.token[0];
                } else if (kind == "eol_pop") {
                    let anyStyle: Style = styles.entries().next().value;
                    currentTMContext["end"] = EOL_REGEX;
                    currentTMContext["endCaptures"]["1"] = { name: anyStyle.textmate };
                    aceGrammar.rules[currentAceRule].push({
                        token: anyStyle.ace,
                        regex: EOL_REGEX,
                        next: "pop",
                    });
                } else if (kind == "include") {
                    let current = scopes.current.parent.name;
                    let target = (node.body[0] as N.String).value;

                    if (!inclusions.has(target)) {
                        err(`Unknown context '${target}'`, node.body[0].loc, true);
                        return;
                    }

                    // console.log(scopes.current);
                    // if (targets.indexOf(n) != i) {
                    //     err("Redundant include", includeList[i].loc, true); //TODO: make this a warning instead
                    // }

                    // Test for circular inclusions
                    let result = checkRecursion([current, target]);
                    if (result && current == result[result.length - 1]) {
                        var trace = result.join(" → ");
                        err(`Cyclic inclusion detected (${trace})`, node.loc, true);
                    } else {
                        currentTMContext.patterns.push({ include: "#" + target });
                        //NOTE: Include doesn't exist in ace, we're just adding this to be replaced later
                        aceGrammar.rules[currentAceRule].push({ include: target });
                    }
                } else if (kind == "context") {
                    if (currentCollection != "contexts") {
                        err(
                            `Unexpected object type ${kind}. Did you mean to place it in collection 'contexts'?`,
                            node.kind.loc,
                            true
                        );
                        return;
                    }
                    if (!name) return err(`Unnamed context`, node.loc, false);
                    //@ts-expect-error
                    tmGrammar.repository[name] = currentTMContext = { patterns: [] };
                    aceGrammar.rules[(currentAceRule = name)] = [];
                    for (let n of node.body) {
                        if (!isAttribute(n)) traverse(n);
                    }
                    currentTMContext = null as any;
                } else if (kind == "style") {
                    if (currentCollection == "styles") {
                        if (!name) return err(`Unnamed style`, node.loc, false);
                        let style: Style = {
                            name: name,
                            textmate: "text." + tmGrammar.name,
                            ace: "text." + tmGrammar.name,
                        };
                        let color = s.get("color")?.expanded as string;
                        if (color) style.color = color;
                        let textmate = s.get("textmate_scope")?.expanded as string;
                        let ace = s.get("ace_scope")?.expanded as string;
                        if (textmate) style.textmate = textmate + "." + tmGrammar.name;
                        if (ace) style.ace = ace;
                        if (textmate && !ace) style.ace = textmate;
                        if (!textmate && ace) style.textmate = style.ace;
                        styles.set(name, style);
                    } else
                        err(
                            `Unexpected object type ${kind}. Did you mean to place it in collection 'styles'?`,
                            node.kind.loc,
                            true
                        );
                } else {
                    err(`Unexpected object type ${kind}`, node.kind.loc, true);
                }
            } finally {
                // Ensures we pop the scope even if we return after an erorr
                scopes.pop();
            }
        } else throw new Error("Unexpected node type " + node["type"]);
    }

    traverse(ast);

    if (!errors.find((e) => e.fatal)) {
        // Expand includes
        for (let r in aceGrammar.rules) {
            //TODO: prevent circular includes
            let rule = aceGrammar.rules[r];
            let pos: number;
            //TODO: improve performance by finding from last index + added items
            while ((pos = rule.findIndex((p) => "include" in p)) > -1) {
                let target = (rule[pos] as AcePatternInclude)["include"];
                // console.log(r, target, aceGrammar.rules[target]);
                rule.splice(pos, 1, ...aceGrammar.rules[target]);
            }
        }
        // Rename main to start
        aceGrammar.rules.start = aceGrammar.rules.main || [];
        delete aceGrammar.rules.main;
        for (let r in aceGrammar.rules) {
            // Remove unused rules
            if (r != "start" && !r.match(/__\d+$/)) delete aceGrammar.rules[r];
            // Add default token
            else if (options.aceDefaultToken) {
                let rr = aceGrammar.rules[r];
                if (rr.length > 0 && "defaultToken" in rr[rr.length - 1]) rr.push({ defaultToken: "text" });
            }
        }
    }

    return {
        errors,
        textmate: tmGrammar,
        ace: aceGrammar,
        makeTextmateXML: () => js2plist(tmGrammar as any),
        makeAceHighlighter: (options?: makeAceHighlighterOptions) => makeAceHighlighter(aceGrammar, options),
        makeCss: () => makeCss(styles),
        styles,
        global: scopes.global,
        ast,
    };
}

export interface makeAceHighlighterOptions {
    spacing?: number;
}
export function makeAceHighlighter(aceGrammar: AceGrammar, options?: makeAceHighlighterOptions) {
    var { name, rules } = aceGrammar;
    return `define(function(require, exports, module) {
"use strict";
var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
/* --------------------- START ----------------------------- */
var ${name}HighlightRules = function() {
this.$rules = ${JSON.stringify(rules, null, options?.spacing)};
this.normalizeRules();
};
/* ------------------------ END ------------------------------ */
oop.inherits(${name}HighlightRules, TextHighlightRules);
exports.${name}HighlightRules = ${name}HighlightRules;
});`;
}

export function makeCss(styles: Map<string, Style>) {
    //TODO: make css
    return ``;
}
