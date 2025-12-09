export class PromptError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PromptError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static isPromptError(error: unknown): error is PromptError {
    return error instanceof PromptError;
  }
}
