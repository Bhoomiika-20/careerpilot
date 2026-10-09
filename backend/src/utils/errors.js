export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const must = (value, status = 404, message = 'Record not found') => { if (!value) throw new AppError(status, message); return value; };
export function safeError(error) { return error.status ? error.message : 'The request could not be completed. Please try again.'; }
