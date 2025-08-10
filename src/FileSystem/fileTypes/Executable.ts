export interface Executable {
  run: (args: string[]) => Promise<void>;
}
