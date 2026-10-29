export class ReillustrateError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'ReillustrateError';
  }
}
