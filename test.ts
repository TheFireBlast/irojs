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
    console.log(regex, list);
    return list;
}

console.log(getRegexGroups("([a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+(/[a-zA-Z0-9_.-]+)*)({)"))