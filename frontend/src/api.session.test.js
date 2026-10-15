import { describe, it, expect, beforeEach } from 'vitest';
import { storeSession, getStoredToken, userStore, clearStoredSession } from './api';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('session storage (Remember me)', () => {
  it('unchecked keeps the token in sessionStorage only', () => {
    storeSession('t1', false);
    expect(sessionStorage.getItem('performa_token')).toBe('t1');
    expect(localStorage.getItem('performa_token')).toBeNull();
    expect(getStoredToken()).toBe('t1');
  });

  it('checked keeps the token in localStorage and drops the session copy', () => {
    sessionStorage.setItem('performa_token', 'old');
    storeSession('t2', true);
    expect(localStorage.getItem('performa_token')).toBe('t2');
    expect(sessionStorage.getItem('performa_token')).toBeNull();
  });

  it('the signed-in user is stored alongside the token', () => {
    storeSession('t3', false);
    expect(userStore()).toBe(sessionStorage);
    storeSession('t4', true);
    expect(userStore()).toBe(localStorage);
  });

  it('clearStoredSession removes the token and user from both stores', () => {
    localStorage.setItem('performa_token', 'a');
    localStorage.setItem('performa_user', '{}');
    sessionStorage.setItem('performa_token', 'b');
    sessionStorage.setItem('performa_user', '{}');
    clearStoredSession();
    expect(getStoredToken()).toBeNull();
    expect(localStorage.getItem('performa_user')).toBeNull();
    expect(sessionStorage.getItem('performa_user')).toBeNull();
  });
});
