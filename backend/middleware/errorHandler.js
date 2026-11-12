const { validationResult } = require('express-validator');

/**
 * Middleware to handle express-validator errors uniformly.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      details: errors.array()
    });
  }
  next();
}

/**
 * Global Express error handler.
 * Never leaks stack traces or DB credentials in production.
 */
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.expose || status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    console.error('[Server Error]', err);
  }

  res.status(status).json({ error: message });
}

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

module.exports = {
  handleValidation,
  errorHandler,
  AppError
};
