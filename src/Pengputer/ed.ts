/*
 *    ?
 */
import { type PC } from "./PC";
import { Std } from "../Std";
import { type Executable } from "../FileSystem/fileTypes";
import { type FileInfo, FilePath, FileSystemObjectType } from "../FileSystem";

interface ParsedCommand {
    cmd: string|null;
    arg: string|null;
    cur: number;
};

export class EdApp implements Executable {
    private pc: PC;
    private std: Std;

    private lines: string[];
    private lineNo: number;
    private file: FileInfo | null;
    private path: FilePath | null;

    constructor(pc: PC) {
        this.pc = pc;
        this.std = pc.std;
        this.lines = [];
        this.lineNo = 0;
        this.file = null;
        this.path = null;
    }

    private readFile(): number {
        if(!this.file) throw new Error("called readFile with no file");
        this.lines = this.file.data.getText().split('\n');
        return this.file.data.getText().length;
    }

    private writeFile(fileName: string | null): number {
        /* standartized error handling and better FS.open would be nice :P */
        const { std } = this;
        let wpath: FilePath|null = null;
        let wfile: FileInfo|null = null;

        // pick file to write to: `fileName` > this.path > ERROR
        if(fileName) {
            wpath = FilePath.tryParse(fileName, null);
            console.log(wfile);
            if(!wpath) {
                return -1;
            }
        } else {
            wpath = this.path;
            wfile = this.file;
        }

        if(!wpath) {
            // no destination
            return -1;
        }

        // open file for writing
        if(!wfile) {
            try {
                let fileInf = this.pc.fileSystem.getFileInfo(wfile, /*create*/ true);
                if(fileInf) {
                    if(fileInf.type == FileSystemObjectType.Directory) {
                        std.writeConsole(fileName+": Is a directory\n");
                        return -2;
                    } else if(fileInf.type != FileSystemObjectType.TextFile) {
                        std.writeConsole(fileName+": Not editable\n");
                        return -2;
                    }
                } else return -1; // you really fucked up
                wfile = fileInf;
            } catch(e) {
                if(e.message) {
                    if(/read-only/.test(e.message)) {
                        std.writeConsole(fileName+": Drive is read-only\n");
                        return -2;
                    } else if(/not mounted/.test(e.message)) {
                        std.writeConsole(fileName+": Drive is not mounted\n");
                        return -2;
                    } else if(/no drive/.test(e.message)) {
                        std.writeConsole("You must provide an absolute path due to implementation details.\n");
                        return -2;
                    }
                } else e.message = "unknown error";
                std.writeConsole("Error: "+e.message+"\n");
                console.error(e);
                return -2;
            }
        }

        // legal:
        // this.path && this.file (ignore)
        //  this.path && !this.file (set this.file)
        // !this.path && !this.file (set both)
        if(this.file) {
            if(!this.path) throw new Error("EDeezNuts violation: illegal right nut state");
        } else {
            // no file was opened; configure default write destination
            this.file = wfile;
            if(!this.path) this.path = wpath;
        }

        const text = this.lines.join('\n');
        this.file.data.replace(text);

        return text.length;
    }

    private async readUserLines(): Promise<string[]> {
        // read user input until a line with a plain dot "." and report all lines preceding it
        let lines: string[] = [];

        while(true) {
            let line = await this.std.readConsoleLine();
            if(line == null) continue;
            if(line == '.') break;
            lines.push(line);
        }
        return lines;
    }

    async run(args: string[]) {
        /* This implementation would have greatly benefited from `goto` */
        const { std } = this;
        args.shift();
        if(args.length > 0) {
            const fileName = args[0];
            const filePath = FilePath.tryParse(fileName, null);
            if(!filePath) {
                std.writeConsole("Failed to parse file path\n");
                return;
            }
            this.file = this.pc.fileSystem.getFileInfo(filePath);
            console.log(this.file, filePath);
            if(this.file) {
                if(this.file.type != FileSystemObjectType.TextFile) {
                    std.writeConsole(fileName+": Not editable\n");
                    return;
                }
                std.writeConsole(String(this.readFile())+"\n");
            } else {
                std.writeConsole(fileName+": No such file\n");
            }
            this.path = filePath;
        }

        // parsing funcs
        const isalnum = (c:string) => (48 <= c.charCodeAt() && c.charCodeAt() <= 57);
        const isspace = (c:string) => (c == ' ' || c == '\r' || c == '\n' || c == '\t');

        let line = 0;

        while(true) {
            // command: [range][cmd] [arg]
            // !! line indices are 1-based !!
            let range = [0, 0];
            let cmd: string|null = null;
            let arg: string|null = null;
            let cur = 0;

            let line = await std.readConsoleLine();
            console.log(line);
            if(!line || line.trim().length == 0) {
                std.writeConsole("?\n");
                continue;
            }

            // parse range
            // TODO: offsets relative to EOF (e,g, `$-3,$`)
            // TODO: other ranges from ed (like ; . )
            for(let i = 0; i < 2; i++) {
                let parsed = false;
                if(i==0 && !isalnum(line[cur]) && line[cur] != ',') break;
                while(cur < line.length && isalnum(line[cur])) {
                    parsed = true;
                    range[i] *= 10;
                    range[i] += line.charCodeAt(cur) - 48;

                    cur++;
                }
                if(cur >= line.length) break;
                if(!parsed) {
                    if(i===0) range[i] = 1;
                    if(i===1) range[i] = this.lines.length;
                }
                if(i === 0) {
                    if(line[cur] !== ',') {
                        range[1] = range[0];
                        break;
                    }
                    cur++;
                }
            }
            console.log(range);

            if(range[0] > range[1]) {
                std.writeConsole("?\n");
                continue;
            }

            for(; cur < line.length && isspace(line[cur]); cur++ ) { }
            line = line.slice(cur);
            cur = 0;

            // parse command
            for(; cur < line.length && !isspace(line[cur]); cur++ ) { }

            if(cur != 0) {
                cmd = line.slice(0, cur);
                for(; cur < line.length && isspace(line[cur]); cur++ ) { }
                line = line.slice(cur);
                cur = 0;
            }

            // parse argument
            for(; cur < line.length && !isspace(line[cur]); cur++ ) { }

            if(cur != 0) {
                arg = line.slice(0, cur);
                for(; cur < line.length && isspace(line[cur]); cur++ ) { }
                line = line.slice(cur);
                cur = 0;
            }

            if(0) {
                std.writeConsole("Parsed command:\n");
                std.writeConsole("  Range:    " + range.join('->') + "\n");
                std.writeConsole("  Command:  " + String(cmd) + "\n");
                std.writeConsole("  Argument: " + String(arg) + "\n");
            }

            if(cmd == null) {
                if(range[0] != 0 && range[1] != 0) {
                    // observed behavior from GNU ed
                    let newLine: number;
                    if(range[1] == 0)
                        newLine = range[0];
                    else newLine = range[1];

                    if(newLine >= this.lines.length) std.writeConsole("?\n");
                    else {
                        std.writeConsole(this.lines[newLine-1]+"\n");
                        this.lineNo = newLine;
                    }
                }
                continue;
            }

            cmd = cmd.toLowerCase();

            if(cmd == 'q') {
                return;
            } else if(cmd == 'l' || cmd == 'p' || cmd == 'n') {
                if(range[0] == 0) {
                    range[0] = range[1] = this.lineNo?this.lineNo:1;
                }
                if(range[0]-1 >= this.lines.length) {
                    std.writeConsole("?\n");
                    continue;
                }
                for(let i = range[0]-1; i <= range[1]-1; i++) {
                    let line = this.lines[i];
                    if(cmd == 'n') line = String(i+1) + "  " + line;
                    else if(cmd == 'l') {
                        line = line
                            .replace("\t", "\\t")
                            .replace("\r", "\\r")
                            .replace("\0", "\\0")
                            .replace("$", "\\$");
                        line += "$";
                    }
                    std.writeConsole(line+"\n");
                }
                continue;
            } else if(cmd == 'c') {
                if(!this.lineNo) this.lineNo = this.lines.length;
                if(range[0]) this.lineNo = range[0];
                // replace lines
                const lines = await this.readUserLines();
                if(lines.length == 0) {
                    // remove this line
                    this.lines[this.lineNo-1] = null;
                    this.lines = this.lines.filter(l => l != null && l != undefined);
                } else {
                    console.log(lines);
                    let i: number;
                    for(i = 0; i < lines.length; i++ ) {
                        console.log(i);
                        this.lines[this.lineNo-1+i] = lines[i];
                    }
                    this.lineNo += i-1;
                }
                continue;
            } else if(cmd == 'a') {
                // append after current line
                const lines = await this.readUserLines();
                if(!lines.length) continue;

                if(!this.lineNo) this.lineNo = this.lines.length;
                if(range[0]) this.lineNo = range[0];
                this.lineNo += 1;

                const latter = [...this.lines.slice(this.lineNo-1)];
                console.log(latter);

                let i: number;
                for(i = 0; i < lines.length; i++ ) {
                    this.lines[this.lineNo-1+i] = lines[i];
                }

                console.log(this.lines.slice(0, this.lineNo-1+i), latter);
                this.lines = [...this.lines.slice(0, this.lineNo-1+i), ...latter];

                continue;
            } else if(cmd == 'd') {
                if(!range[0]) {
                    range[0] = range[1] = this.lineNo?this.lineNo:this.lines.length;
                }
                for(let i = range[0]; i <= range[1]; i++ ) {
                    this.lines[i-1] = null;
                }
                this.lines = this.lines.filter(l => l!=null && l!=undefined);
                this.lineNo = range[0];
                if(this.lineNo > this.lines.length) this.lineNo = this.lines.length;

                continue;
            } else if(false) {
            } else if(cmd == 'w') {
                if(!this.file && !arg && false) {
                    std.writeConsole("?\n");
                    continue;
                }
                const written = this.writeFile(arg);
                if(written == -1) {
                    std.writeConsole("?\n");
                } else if(written >= 0) {
                    std.writeConsole(String(written)+"\n");
                }
                continue;
            }

            std.writeConsole("?\n");
        }
    }
}
