import { Attribute } from "./nodes";

export class CompiledAttribute {
    expanded: string | string[] | undefined;
    constructor(
        public name: string,
        public type: Attribute["type"],
        public scope: Scope,
        public source: Attribute,
    ) {}
    get isExpanded() {
        return this.expanded !== undefined;
    }
    get fullName() {
        return ScopeManager.prototype.getPath(this.scope) + this.name;
    }
}

export class Scope extends Map<string, CompiledAttribute> {
    children: Scope[] = [];
    constructor(
        public name: string,
        public parent?: Scope,
    ) {
        super();
    }
}

export class ScopeManager {
    global: Scope;
    current: Scope;
    constructor() {
        this.global = this.current = new Scope("");
    }
    push(newScope: Scope | string) {
        if (typeof newScope == "string") {
            let name = newScope;
            newScope = new Scope(name);
        }
        var names = this.current.children.map((s) => s.name);
        // console.log(this.current.name || "global", names);
        if (newScope.name[0] == "?") {
            let i = 0;
            while (names.includes(i + newScope.name)) i++;
            newScope.name = i + newScope.name;
        } else if (names.includes(newScope.name)) {
            return false;
        }
        // this.stack.push(this.current);
        newScope.parent = this.current;
        this.current.children.push(newScope);
        this.current = newScope;
        return this.current;
    }
    pop() {
        if (this.current.parent) this.current = this.current.parent;
    }
    set(name: string, value: Attribute) {
        this.current.set(name, new CompiledAttribute(name, value.type, this.current, value));
    }
    get<certain extends boolean>(
        name: string,
        scope?: Scope,
    ): certain extends true ? CompiledAttribute : CompiledAttribute | undefined {
        var s: Scope | undefined = scope || this.current;
        while (s) {
            var x = s.get(name);
            if (x !== undefined) return x;
            s = s.parent;
        }
        //@ts-expect-error
        return undefined;
    }
    getPath(scope = this.current) {
        var path = "";
        var s: Scope | undefined = scope;
        while (s) {
            path = s.name + "::" + path;
            s = s.parent;
        }
        return path.slice(2);
    }
}
