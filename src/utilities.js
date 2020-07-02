export const getLastEntry = (array) => {
  if (array.length === 0) {
    throw new Error('array expected to have value');
  }

  return array[array.length - 1];
};

export const distinct = (array) => [...new Set(array)];

export const areAllValuesDistinct = (values) => distinct(values).length === values.length;

export const flattenMultiArray = (array) => array.reduce((previous, current) => previous.concat(current), []);

export const defineNonIterableProperty = (object, key, value) =>
  Object.defineProperty(object, key, {
    value,
    enumerable: false,
    writable: false,
    configurable: false,
  });

export const addSymbol = (object, symbol) => defineNonIterableProperty(object, symbol, true);

export const hasSymbol = (object, symbol) => object[symbol] === true;

// Delayed resolution without using promises
const delayedSymbol = Symbol();
export const createDelayedObject = () => {
  const obj = {
    [delayedSymbol]: true,
  };

  const accept = (value) => {
    obj.value = value;
  };

  return { obj, accept };
};

export const delayedObjectFlatten = (obj) => {
  const matches = Object.entries(obj).filter((entry) => entry[1]?.[delayedSymbol]);
  if (matches.length === 0) {
    return obj;
  }

  const copy = { ...obj };
  matches.forEach(([key, value]) => {
    copy[key] = value.value;
  });

  return copy;
};

export const replaceObject = (destination, source) => {
  deleteItemsFromObject(destination);
  Object.assign(destination, source);
};

const deleteItemsFromObject = (obj) => Object.keys(obj).forEach((key) => delete obj[key]);
