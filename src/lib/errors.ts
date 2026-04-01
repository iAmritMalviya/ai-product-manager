export class AIError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AIError";
    this.cause = cause;
  }
}

export class DatabaseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.cause = cause;
  }
}

export class QueueError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "QueueError";
    this.cause = cause;
  }
}
