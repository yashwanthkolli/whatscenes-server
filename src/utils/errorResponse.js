class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Captures the stack trace excluding the constructor call
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorResponse;