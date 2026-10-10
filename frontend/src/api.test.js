import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, getApiErrorMessage } from './api';

describe('getApiErrorMessage', () => {
  it('returns a string detail verbatim', () => {
    expect(getApiErrorMessage({ response: { data: { detail: 'Nope' } } })).toBe('Nope');
  });

  it('joins a 422 validation detail array', () => {
    const error = { response: { data: { detail: [{ msg: 'required' }, { msg: 'too short' }] } } };
    expect(getApiErrorMessage(error)).toBe('required, too short');
  });

  it('falls back to an error message, then the default', () => {
    expect(getApiErrorMessage({ message: 'boom' }, 'fallback')).toBe('boom');
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('apiClient 401 handling', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = async () => {
      const error = new Error('Request failed with status code 401');
      error.response = { status: 401, data: {} };
      error.config = {};
      throw error;
    };
  });

  it('clears the stored session and dispatches performa:unauthorized', async () => {
    localStorage.setItem('performa_user', 'x');
    localStorage.setItem('performa_token', 'y');
    const handler = vi.fn();
    window.addEventListener('performa:unauthorized', handler);

    await expect(apiClient.get('/protected')).rejects.toThrow();

    expect(localStorage.getItem('performa_user')).toBeNull();
    expect(localStorage.getItem('performa_token')).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('performa:unauthorized', handler);
  });
});
