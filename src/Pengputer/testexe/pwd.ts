import { type PC } from "../PC";
import { type Executable } from "../../FileSystem/fileTypes";

export class TestPwd implements Executable {
    private pc: PC;
    constructor(pc: PC) {
        this.pc = pc;
    }

    async run(args: string[]) {
        const { std } = this.pc;
        std.writeConsole(std.getCwdStr());
    }
}
