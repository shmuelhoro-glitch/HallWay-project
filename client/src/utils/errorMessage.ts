import { ApiError } from '../api/client';

// A message the user can read, from any error.
// Our server already sends clear English messages, so we show them as they are.
// For a validation error we show the first field that failed: "name: Name is required".
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof ApiError)) {
    // fetch itself failed: no internet, or the server is down / waking up
    return fallback;
  }

  if (error.code === 'VALIDATION_ERROR') {
    const [field, problems] = Object.entries(error.fields)[0] ?? [];
    if (field && problems && problems.length > 0) {
      return `${field}: ${problems[0]}`;
    }
  }

  return error.message;
}
