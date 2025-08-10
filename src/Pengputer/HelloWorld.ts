import { type Executable } from "@FileSystem/index";
import { type PC } from "./PC";

export class HelloWorld implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }
  async run(args: string[]) {
    this.pc.std.writeConsole("Hello, world!\n");
  }
}
