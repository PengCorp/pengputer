export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = "AppError";
  }
}
