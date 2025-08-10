import { type Executable } from "./FileSystem";
import { type PC } from "./PC";

export class DateApp implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }

  async run(args: string[]) {
    this.pc.std.writeConsole(`${new Date()}\n`);
  }
}
