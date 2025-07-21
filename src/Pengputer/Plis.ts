import { PC } from "./PC";
import { Executable } from "./FileSystem";
import { classicColors } from "../Color/ansi";

type PlisPrimitive = string | number | null;
type PlisList = PlisPrimitive[];
type PlisType = PlisPrimitive | PlisExpression | PlisList;

type PlisExpression = {
  func: string | PlisBuiltinFunctionName,
  args: PlisType[],
};

enum PlisBuiltinFunctionName {
  noop = "do-absolutely-nothing",

  cdr = "cdr",
  car = "car",
  list = "list",
  len = "len",
  in = "in",
  nth = "nth",
  map = "map",
  filter = "filter",
  reverse = "reverse",

  // type level functions
  islist = "list?",
  isstring = "string?",
  isnull = "null?",
  isobject = "object?",

  add = "+",
  mult = "*",
  sub = "-",
  div = "/",
  mod = "%",
  sqrt = "sqrt",
  log = "log",
  max = "max",
  min = "min",

  defun = "defun",
  def = "def",
  set = "set" // actual variable
}

export class PlisInterpreter implements Executable {

  private _pc: PC;
  public get pc(): PC {
    return this._pc;
  }

  private constants: Map<string, PlisType> = new Map();
  private variables: Map<string, PlisType> = new Map();

  private builtinHandler = new PlisBuiltinHandler();

  constructor(pc: PC)
  {
    this._pc = pc;
  }
  
  public async run(args: string[]):  Promise<void> {
    const startTime = new Date();
    // assume first arg is our full program (for now)

    // the interpreter should actually treewalk and then call the builtin handler, but we are just testing builtins for now
    console.log(
      this.builtinHandler.handle(this, {
        func: "car",
        args: [[2,3,4]]
      }),
      this.builtinHandler.handle(this, {
        func: "set",
        args: ["first-list", [1,2,3]]
      }),
      this.builtinHandler.handle(this, {
        func: "car",
        args: ["first-list"]
      }),
    );

    const endSeconds = (new Date().getTime() - startTime.getTime()) / 1000;
    this.pc.std.writeConsole(`\nProgram execution took ${endSeconds.toPrecision(2)} seconds`)

    console.log(this.getUserDefinedValues());
  }

  public setVariable(name: string, value: PlisType) {
    this.variables.set(name, value);
  }

  public getVariable(name: string): PlisType {
    return this.variables.get(name) ?? null;
  }

  public setConstant(name: string, value: PlisPrimitive) {
    return this.constants.set(name, value);
  }

  public getConstant(name: string): PlisType {
    return this.constants.get(name) ?? null;
  }

  public getUserDefinedValue(name: string): PlisType {
    let result = this.variables.get(name) 
      ?? this.constants.get(name);
    
    if (!result) { 
      throw new PlisRuntimeError(`Variable \`${name}\` is undefined.`);
    }

    return result;
  }

  private getUserDefinedValues() {
    return {
      constants: this.constants,
      variables: this.variables
    };
  }
}

type PlisBuiltinFunction = (context: PlisInterpreter, expr: PlisExpression) => PlisType;

class PlisBuiltinHandler {

  private builtins: Record<PlisBuiltinFunctionName, PlisBuiltinFunction> = {
    "do-absolutely-nothing": builtinNoop,
    "car": builtinCar,
    "def": builtinDef,
    "set": builtinSet
  };

  public handle(context: PlisInterpreter, expr: PlisExpression): PlisType {
    let result: PlisType = null;
    try {
      result = this.builtins[expr.func as PlisBuiltinFunctionName](context, expr);
    } catch(e: unknown) {
      context.pc.std.writeConsoleSequence(
        [
          {fgColor: classicColors["red"]},
          (e as Error).message,
          "\n"
        ],
        {reset: true, resetBefore: true}
      );
    }
    return result;
  }
}

class PlisParser {

  public parse(program: string): PlisExpression[] {
    return [];
  }

}

function isPlisPrimitive(value: PlisType): value is PlisPrimitive {
  return (value as PlisExpression).args === null;
}

function isPlisString(value: PlisType): value is string {
  return value instanceof String || typeof value === "string";
}

function isPlisList(value: PlisType): value is PlisList {
  return Array.isArray(value);
}

function isPlisExpression(value: PlisType): value is PlisExpression {
  return (value as PlisExpression).args !== undefined;
}

class PlisRuntimeError extends Error {}
class PlisTypeError extends PlisRuntimeError {}
class PlisUnsupportedOperationError extends PlisRuntimeError {}

/// ---
/// actual builtin implementation
/// ---

// copy this when adding new builtin functions
const builtinNoop = (context: PlisInterpreter, expr: PlisExpression): PlisType => {
  return null;
}

const builtinCar = (context: PlisInterpreter, expr: PlisExpression): PlisType => {
  if (expr.args.length != 1) {
    throw new PlisRuntimeError(`Builtin \`car\` requires 1 argument, ${expr.args.length} given.`)
  }

  if (isPlisString(expr.args[0])) {
    let list = context.getUserDefinedValue(expr.args[0]);

    if (!isPlisList(list) && !isPlisString(list)) {
      console.log(list);
      throw new PlisTypeError(`Type of variable passed to \`car\` is not a list or string - received ${typeof expr.args[0]}`);
    }
    return list[0];
  }

  if (!isPlisList(expr.args[0])) {
    throw new PlisTypeError(`Name of variable passed to \`car\` is not a list - received ${typeof expr.args[0]}`);
  }

  return expr.args[0][0];
}

const builtinDef = (context: PlisInterpreter, expr: PlisExpression): PlisType => {
  if (expr.args.length != 2) {
    throw new PlisRuntimeError(`Builtin \`def\` requires 2 arguments, ${expr.args.length} given.`)
  }
  if (typeof expr.args[0] !== "string") {
    throw new PlisTypeError(`Name of variable passed to \`set\` must be of type string - received ${typeof expr.args[0]}.`);
  }
  if (!isPlisPrimitive(expr.args[1])) {
    throw new PlisTypeError("You may not assign functions to constants, please use `defun` instead.")
  }

  context.setConstant(expr.args[0], expr.args[1]);
  return expr.args[1];
}

const builtinSet = (context: PlisInterpreter, expr: PlisExpression): PlisType => {
  if (expr.args.length != 2) {
    throw new PlisRuntimeError(`Builtin \`set\` requires 2 arguments, ${expr.args.length} given.`)
  }
  if (!isPlisString(expr.args[0])) {
    throw new PlisTypeError(`Argument \`name\` of \`set\` must be of type string - received ${typeof expr.args[0]}.`);
  }

  // TODO(boons): siller
  if (isPlisExpression(expr.args[1])) {
    throw new PlisUnsupportedOperationError("Traversing expressions to set variables is not yet supported");
  }

  context.setVariable(expr.args[0], expr.args[1]);
  return expr.args[1];
}