const connectionFactories = [];

export const displayFlat = 'flat';
export const displayCount = 'count';
export const displayObject = 'object';

export const registerBackend = (creator) => {
  connectionFactories.push(creator);
};

export const createBackend = (connectionString) => {
  for (const backendEngine of connectionFactories) {
    const match = backendEngine(connectionString);
    if (match) {
      return match;
    }
  }

  throw new Error(
    `failed to find backend matching connection string (connection string omitted because it may contain sensitive information)`
  );
};
