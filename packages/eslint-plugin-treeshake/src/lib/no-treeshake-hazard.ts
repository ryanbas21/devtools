import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { EXPLANATIONS } from './explanations.js';
import { isKnownPure } from './known-pure.js';
import { isModuleScope, getCalleeName, hasPureAnnotation } from './scope-utils.js';

const MUTATION_METHODS = new Set([
  'Object.defineProperty',
  'Object.defineProperties',
  'Object.setPrototypeOf',
]);

const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self', 'global']);

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ryanbas21/devtools/blob/main/packages/eslint-plugin-treeshake/docs/rules/${name}.md`,
);

type RuleOptions = [
  {
    checkEnums?: boolean;
    checkUnannotatedCalls?: boolean;
    checkPrototypeMutation?: boolean;
    checkGlobalAssignment?: boolean;
    checkCjsPatterns?: boolean;
    additionalPureFunctions?: string[];
    bundleCheck?: boolean;
    bundleCheckCwd?: string;
  },
];

type MessageIds =
  | 'enumPattern'
  | 'unannotatedCall'
  | 'prototypeMutation'
  | 'globalAssignment'
  | 'cjsPatterns'
  | 'topLevelSideEffect'
  | 'missingSideEffectsField'
  | 'unknown'
  | 'enumSuggestion';

const buildMessage = (category: keyof typeof EXPLANATIONS): string => {
  const e = EXPLANATIONS[category];
  return `${e.summary} ${e.why} ${e.fix}`;
};

export const noTreeshakeHazard = createRule<RuleOptions, MessageIds>({
  name: 'no-treeshake-hazard',
  meta: {
    type: 'problem',
    docs: {
      description: 'Flags code patterns known to break tree-shaking.',
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          checkEnums: { type: 'boolean' },
          checkUnannotatedCalls: { type: 'boolean' },
          checkPrototypeMutation: { type: 'boolean' },
          checkGlobalAssignment: { type: 'boolean' },
          checkCjsPatterns: { type: 'boolean' },
          additionalPureFunctions: {
            type: 'array',
            items: { type: 'string' },
          },
          bundleCheck: { type: 'boolean' },
          bundleCheckCwd: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      enumPattern: buildMessage('EnumPattern'),
      unannotatedCall: buildMessage('UnannotatedCall'),
      prototypeMutation: buildMessage('PrototypeMutation'),
      globalAssignment: buildMessage('GlobalAssignment'),
      cjsPatterns: buildMessage('CjsPatterns'),
      topLevelSideEffect: buildMessage('TopLevelSideEffect'),
      missingSideEffectsField: buildMessage('MissingSideEffectsField'),
      unknown: buildMessage('Unknown'),
      enumSuggestion: 'Replace enum with an as const object and type alias.',
    },
  },
  defaultOptions: [
    {
      checkEnums: true,
      checkUnannotatedCalls: true,
      checkPrototypeMutation: true,
      checkGlobalAssignment: true,
      checkCjsPatterns: true,
      additionalPureFunctions: [],
      bundleCheck: false,
      bundleCheckCwd: undefined,
    },
  ],
  create(context, [options]) {
    const {
      checkEnums = true,
      checkUnannotatedCalls = true,
      checkPrototypeMutation = true,
      checkGlobalAssignment = true,
      checkCjsPatterns = true,
      additionalPureFunctions = [],
    } = options;

    const sourceCode = context.sourceCode;

    /**
     * Build the replacement text for an enum → as const object suggestion.
     */
    function buildEnumReplacement(node: TSESTree.TSEnumDeclaration, isExported: boolean): string {
      const name = node.id.name;
      const members = (node.body?.members ?? node.members)
        .map((m) => {
          const key = m.id.type === 'Identifier' ? m.id.name : sourceCode.getText(m.id);
          const value = m.initializer ? sourceCode.getText(m.initializer) : `"${key}"`;
          return `  ${key}: ${value}`;
        })
        .join(',\n');

      const exportPrefix = isExported ? 'export ' : '';
      const obj = `${exportPrefix}const ${name} = {\n${members},\n} as const;`;
      const type = `${exportPrefix}type ${name} = (typeof ${name})[keyof typeof ${name}];`;
      return `${obj}\n${type}`;
    }

    return {
      // 1. TSEnumDeclaration
      TSEnumDeclaration(node: TSESTree.TSEnumDeclaration) {
        if (!checkEnums || !isModuleScope(node)) return;

        const isExported = node.parent?.type === 'ExportNamedDeclaration';
        const reportNode = isExported ? node.parent! : node;

        context.report({
          node,
          messageId: 'enumPattern',
          suggest: [
            {
              messageId: 'enumSuggestion',
              fix(fixer) {
                return fixer.replaceText(reportNode, buildEnumReplacement(node, isExported));
              },
            },
          ],
        });
      },

      // 2. CallExpression — unannotated top-level calls
      CallExpression(node: TSESTree.CallExpression) {
        if (!checkUnannotatedCalls || !isModuleScope(node)) return;

        const calleeName = getCalleeName(node.callee as TSESTree.Expression);
        if (calleeName && isKnownPure(calleeName, additionalPureFunctions)) return;
        if (calleeName && MUTATION_METHODS.has(calleeName)) return;
        if (hasPureAnnotation(sourceCode, node)) return;

        // Skip require() calls — handled by CJS check
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') return;

        context.report({
          node,
          messageId: 'unannotatedCall',
          fix(fixer) {
            return fixer.insertTextBefore(node, '/*#__PURE__*/ ');
          },
        });
      },

      // 3. Prototype mutation — method calls (Object.defineProperty, etc.)
      'ExpressionStatement > CallExpression'(node: TSESTree.CallExpression) {
        if (!checkPrototypeMutation || !isModuleScope(node)) return;

        const calleeName = getCalleeName(node.callee as TSESTree.Expression);
        if (calleeName && MUTATION_METHODS.has(calleeName)) {
          context.report({
            node,
            messageId: 'prototypeMutation',
          });
        }
      },

      // 4. Prototype mutation — assignment (X.prototype.y = ...)
      'ExpressionStatement > AssignmentExpression'(node: TSESTree.AssignmentExpression) {
        if (!checkPrototypeMutation || !isModuleScope(node)) return;

        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'MemberExpression' &&
          !node.left.object.computed &&
          node.left.object.property.type === 'Identifier' &&
          node.left.object.property.name === 'prototype'
        ) {
          context.report({
            node,
            messageId: 'prototypeMutation',
          });
        }
      },

      // 5. Global assignment
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        if (!checkGlobalAssignment || !isModuleScope(node)) return;

        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'Identifier' &&
          GLOBAL_OBJECTS.has(node.left.object.name)
        ) {
          context.report({
            node,
            messageId: 'globalAssignment',
          });
        }
      },

      // 6. CJS — require()
      'CallExpression[callee.name="require"]'(node: TSESTree.CallExpression) {
        if (!checkCjsPatterns || !isModuleScope(node)) return;

        context.report({
          node,
          messageId: 'cjsPatterns',
        });
      },

      // 7. CJS — module.exports
      'MemberExpression[object.name="module"][property.name="exports"]'(
        node: TSESTree.MemberExpression,
      ) {
        if (!checkCjsPatterns || !isModuleScope(node)) return;

        context.report({
          node,
          messageId: 'cjsPatterns',
        });
      },

      // 8. CJS — exports.x (skip if parent is module.exports)
      'MemberExpression[object.name="exports"]'(node: TSESTree.MemberExpression) {
        if (!checkCjsPatterns || !isModuleScope(node)) return;

        // Skip if this is module.exports (avoid double report)
        if (node.parent?.type === 'MemberExpression' && node.parent.object === node) {
          return;
        }

        context.report({
          node,
          messageId: 'cjsPatterns',
        });
      },
    };
  },
});
