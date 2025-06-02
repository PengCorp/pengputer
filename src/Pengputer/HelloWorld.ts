import { Executable } from "./FileSystem";
import { PC } from "./PC";

export class HelloWorld implements Executable {
  private pc: PC;
  constructor(pc: PC) {
    this.pc = pc;
  }
  async run(args: string[]) {
    this.pc.screen.printString("Hello, world!\n");
  }
}
