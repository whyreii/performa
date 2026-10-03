// Keyboard activation helper for elements that behave like buttons/links.

export function activateOnKey(handler) {
  return (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      handler(event);
    }
  };
}
