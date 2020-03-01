export const getLastEntry = array => {
  if (array.length === 0) {
    throw new Error('array expected to have value');
  }

  return array[array.length - 1];
};

export const distinct = array => [...new Set(array)];

export const flattenMultiArray = array => array.reduce((previous, current) => previous.concat(current), []);
