// The entry's background-task wiring (src/store/backgroundTasks.js): the reminder run is defined
// with the root store, and its `ready` waits for redux-persist's rehydration — at once if it's
// already done, otherwise until the persistor reports `bootstrapped`.

const mockDefine = jest.fn();
jest.mock('../features/reminders', () => ({
  defineBackgroundReconcile: (...args) => mockDefine(...args),
}));

// A persistor whose state the test moves by hand, recording its subscribers.
function fakePersistor(bootstrapped) {
  const listeners = new Set();
  let state = { bootstrapped };
  return {
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(next) {
      state = next;
      [...listeners].forEach((fn) => fn());
    },
    listeners,
  };
}

// Loads backgroundTasks.js over a store with `persistor`; returns what it defined.
function load(persistor) {
  const store = { dispatch: jest.fn() };
  jest.isolateModules(() => {
    jest.doMock('.', () => ({ store, persistor }));
    require('./backgroundTasks');
  });
  const [givenStore, ready] = mockDefine.mock.calls.at(-1);
  return { store, givenStore, ready };
}

const settled = async (promise) => {
  let done = false;
  promise.then(() => (done = true));
  await new Promise((resolve) => setImmediate(resolve));
  return done;
};

describe('background tasks at entry load', () => {
  beforeEach(() => mockDefine.mockClear());

  it('defines the reminder run with the root store', () => {
    const { store, givenStore } = load(fakePersistor(true));
    expect(mockDefine).toHaveBeenCalledTimes(1);
    expect(givenStore).toBe(store);
  });

  it('is ready at once when the saved state is already back', async () => {
    const persistor = fakePersistor(true);
    const { ready } = load(persistor);
    expect(await settled(ready())).toBe(true);
    expect(persistor.listeners.size).toBe(0);
  });

  it('waits for rehydration, then stops listening', async () => {
    const persistor = fakePersistor(false);
    const { ready } = load(persistor);
    const waiting = ready();
    expect(await settled(waiting)).toBe(false);

    persistor.set({ bootstrapped: false, registry: ['customReminders'] });
    expect(await settled(waiting)).toBe(false);
    expect(persistor.listeners.size).toBe(1);

    persistor.set({ bootstrapped: true, registry: [] });
    expect(await settled(waiting)).toBe(true);
    expect(persistor.listeners.size).toBe(0);
  });

  it('answers every run, before and after rehydration', async () => {
    const persistor = fakePersistor(false);
    const { ready } = load(persistor);
    const first = ready();
    const second = ready();
    persistor.set({ bootstrapped: true });
    expect(await settled(Promise.all([first, second]))).toBe(true);
    expect(await settled(ready())).toBe(true);
  });
});
