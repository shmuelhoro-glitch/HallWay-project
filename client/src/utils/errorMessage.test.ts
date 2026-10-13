import { describe, expect, test } from 'vitest';
import { ApiError } from '../api/client';
import { getErrorMessage, getMessageForCode } from './errorMessage';

const FALLBACK = 'לא הצלחנו לשמור את המקום. נסו שוב.';
const HEBREW_LETTER = /[֐-׿]/;
const ENGLISH_WORD = /[A-Za-z]{4,}/;

// The code of the server itself, as text: every error code it can send is read from there,
// so a new code that is added to the server without a Hebrew message fails this test.
const serverFiles = import.meta.glob<string>('../../../backend/server/{controllers,middleware,services}/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Not shown through this table: validation has its own message, a server bug gets the message
// of the screen, and dataCheck.service.js is a report for the admin script, not an API error
const HANDLED_ELSEWHERE = ['VALIDATION_ERROR', 'SERVER_ERROR'];

function findServerCodes(): string[] {
  const codes = new Set<string>();
  for (const [path, source] of Object.entries(serverFiles)) {
    if (path.endsWith('dataCheck.service.js')) continue;
    for (const match of source.matchAll(/code: "([A-Z_]+)"/g)) {
      codes.add(match[1]);
    }
  }
  return [...codes].filter((code) => !HANDLED_ELSEWHERE.includes(code)).sort();
}

const SERVER_CODES = findServerCodes();

describe('getMessageForCode', () => {
  test('the error codes of the server were found', () => {
    expect(SERVER_CODES).toContain('EDGE_EXISTS');
    expect(SERVER_CODES).toContain('ADDRESS_NOT_FOUND');
    expect(SERVER_CODES.length).toBeGreaterThan(15);
  });

  test.each(SERVER_CODES)('%s has a Hebrew message', (code) => {
    const message = getMessageForCode(code);

    expect(message).toMatch(HEBREW_LETTER);
  });

  test('a code we do not know has no message', () => {
    expect(getMessageForCode('SOMETHING_NEW')).toBeNull();
  });
});

describe('getErrorMessage', () => {
  test('a known code gets its own message, not the English text of the server', () => {
    const error = new ApiError(409, 'EDGE_EXISTS', 'These points are already connected');

    expect(getErrorMessage(error, FALLBACK)).toBe('הנקודות האלה כבר מחוברות.');
  });

  test('a code we do not know gets the message of the screen', () => {
    const error = new ApiError(418, 'SOMETHING_NEW', 'I am a teapot');

    expect(getErrorMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  test('a bug in the server gets the message of the screen, never technical text', () => {
    const error = new ApiError(500, 'SERVER_ERROR', 'Internal server error');

    expect(getErrorMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  test('no answer from the server at all (no internet) gets the message of the screen', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
  });

  test('without a message of the screen there is still a general Hebrew message', () => {
    expect(getErrorMessage(new Error('boom'))).toMatch(HEBREW_LETTER);
  });

  test('a validation error names the field as it is called on the form', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body', { category: ['Category is required'] });

    expect(getErrorMessage(error, FALLBACK)).toBe('הערך בשדה "קטגוריה" לא תקין.');
  });

  test('a validation error on a field we do not know stays general', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body', { somethingNew: ['Bad'] });
    const message = getErrorMessage(error, FALLBACK);

    expect(message).toMatch(HEBREW_LETTER);
    expect(message).not.toMatch(ENGLISH_WORD);
  });

  test('a validation error without fields stays general', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body');

    expect(getErrorMessage(error, FALLBACK)).toMatch(HEBREW_LETTER);
  });

  test('deleting the entrance of a place names the place', () => {
    const error = new ApiError(409, 'NODE_IN_USE', 'This is the entrance of "Sea Fashion". Delete the place instead.');

    expect(getErrorMessage(error, FALLBACK)).toBe(
      'זו הכניסה של "Sea Fashion". כדי למחוק אותה, מחקו את המקום בלשונית "מקומות".',
    );
  });

  test('deleting the entrance of a place still has a message when the name is missing', () => {
    const error = new ApiError(409, 'NODE_IN_USE', 'Node in use');

    expect(getErrorMessage(error, FALLBACK)).toBe(getMessageForCode('NODE_IN_USE'));
  });
});
