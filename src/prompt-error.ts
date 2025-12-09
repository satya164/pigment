export class PromptError extends Error {
  validation: string | undefined;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PromptError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
