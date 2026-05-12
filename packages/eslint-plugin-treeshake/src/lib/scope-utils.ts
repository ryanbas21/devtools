import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Check whether a node is at the top level of a module (direct child of Program.body).
 * Walk up the parent chain; if we hit Program without crossing a function/class boundary,
 * the node is at module scope.
 */
export const isModuleScope = (node: TSESTree.Node): boolean => {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    switch (current.type) {
      case 'Program':
        return true;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassBody':
      case 'StaticBlock':
        return false;
    }
    current = current.parent;
  }
  return false;
};

/**
 * Extract a human-readable callee name from a CallExpression's callee node.
 * Returns "Object.freeze" for `Object.freeze(...)`, "foo" for `foo(...)`,
 * or null for computed/complex expressions.
 */
export const getCalleeName = (callee: TSESTree.Expression): string | null => {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    return `${callee.object.name}.${callee.property.name}`;
  }
  return null;
};

/**
 * Check whether a node has a leading /*#__PURE__*\/ comment.
 */
export const hasPureAnnotation = (
  sourceCode: { getCommentsBefore(node: TSESTree.Node): TSESTree.Comment[] },
  node: TSESTree.Node,
): boolean => {
  const comments = sourceCode.getCommentsBefore(node);
  return comments.some((c) => c.type === 'Block' && c.value.trim() === '#__PURE__');
};
