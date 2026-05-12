export type HazardCategory =
  | 'EnumPattern'
  | 'UnannotatedCall'
  | 'PrototypeMutation'
  | 'GlobalAssignment'
  | 'CjsPatterns'
  | 'TopLevelSideEffect'
  | 'MissingSideEffectsField'
  | 'Unknown';

export interface HazardExplanation {
  readonly messageId: string;
  readonly summary: string;
  readonly why: string;
  readonly fix: string;
}

export const EXPLANATIONS: Record<HazardCategory, HazardExplanation> = {
  EnumPattern: {
    messageId: 'enumPattern',
    summary: 'TypeScript enum breaks tree-shaking.',
    why: 'TypeScript compiles `enum` to an IIFE that mutates a module-scoped variable. Bundlers keep the entire module.',
    fix: 'Replace with an `as const` object and a derived type alias.',
  },
  UnannotatedCall: {
    messageId: 'unannotatedCall',
    summary: 'Top-level function call without /*#__PURE__*/ annotation.',
    why: 'Bundlers treat bare function calls at module scope as side-effectful and cannot eliminate them.',
    fix: 'Add /*#__PURE__*/ before the call if it has no side effects, or move it inside an exported function.',
  },
  PrototypeMutation: {
    messageId: 'prototypeMutation',
    summary: 'Prototype or property mutation at module scope breaks tree-shaking.',
    why: 'Object.defineProperty, Object.assign, or .prototype assignments at the top level are observable side effects.',
    fix: 'Move the mutation inside a function, or annotate with /*#__PURE__*/ if genuinely side-effect-free.',
  },
  GlobalAssignment: {
    messageId: 'globalAssignment',
    summary: 'Assignment to a global object at module scope breaks tree-shaking.',
    why: 'Assignments to window/globalThis/self/global are observable side effects that bundlers can never eliminate.',
    fix: 'Move the assignment into an explicitly-invoked function or a separate entry point.',
  },
  CjsPatterns: {
    messageId: 'cjsPatterns',
    summary: 'CommonJS pattern in an ESM file prevents tree-shaking.',
    why: 'require(), module.exports, and __esModule markers indicate CommonJS, which bundlers cannot statically analyze.',
    fix: 'Use ESM import/export syntax. Ensure your build emits ESM output.',
  },
  TopLevelSideEffect: {
    messageId: 'topLevelSideEffect',
    summary: 'Top-level statement with side effects prevents tree-shaking.',
    why: 'This statement runs when the module is imported and the bundler cannot prove it is safe to remove.',
    fix: 'Move side-effecting code into an exported function, or annotate pure expressions with /*#__PURE__*/.',
  },
  MissingSideEffectsField: {
    messageId: 'missingSideEffectsField',
    summary: 'package.json is missing the "sideEffects" field.',
    why: 'Without "sideEffects": false, bundlers conservatively assume every module may have side effects, blocking aggressive tree-shaking.',
    fix: 'Add "sideEffects": false to package.json. If some files do have side effects, use an array: "sideEffects": ["./src/polyfill.ts"].',
  },
  Unknown: {
    messageId: 'unknown',
    summary: 'Unknown tree-shaking hazard detected by bundle analysis.',
    why: 'The bundler kept this code but no specific pattern was matched.',
    fix: 'Inspect the surviving code manually. Common causes: getters, decorators, destructuring with defaults, class field initializers.',
  },
};
