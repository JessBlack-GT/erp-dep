const listeners = new Set();
export const sessionEvents = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit(type) {
    listeners.forEach((listener) => listener(type));
  },
};
