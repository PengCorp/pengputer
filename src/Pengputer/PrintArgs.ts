import { Executable } from "./FileSystem";
import { PC } from "./PC";

export class PrintArgs implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }
  async run(args: string[]) {
    for (const arg of args) {
      this.pc.std.writeConsole(`"${arg}"\n`);
    }
  }
}
