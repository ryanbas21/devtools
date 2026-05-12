export const KNOWN_PURE_CALLS: ReadonlySet<string> = new Set([
  // Object
  'Object.freeze',
  'Object.create',
  'Object.keys',
  'Object.values',
  'Object.entries',
  'Object.fromEntries',
  // Symbol
  'Symbol',
  'Symbol.for',
  // Array
  'Array.from',
  'Array.of',
  'Array.isArray',
  // Collections
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  // Number
  'Number.isNaN',
  'Number.isFinite',
  'Number.parseInt',
  'Number.parseFloat',
  // String
  'String.fromCharCode',
  'String.fromCodePoint',
  // JSON
  'JSON.parse',
  'JSON.stringify',
  // Math
  'Math.max',
  'Math.min',
  'Math.floor',
  'Math.ceil',
  'Math.round',
  'Math.abs',
  // Promise
  'Promise.resolve',
  'Promise.reject',
]);

export const isKnownPure = (
  calleeName: string,
  additionalPureFunctions: ReadonlyArray<string> = [],
): boolean => KNOWN_PURE_CALLS.has(calleeName) || additionalPureFunctions.includes(calleeName);
