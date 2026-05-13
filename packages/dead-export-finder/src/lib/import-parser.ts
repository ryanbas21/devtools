import { Context, Effect, Layer } from 'effect';
import oxc from 'oxc-parser';
import type { ImportedSymbol } from './schemas.js';
import { ParseError } from './errors.js';

// ─── AST node types (minimal) ─────────────────────────────────────────────────

interface OxcStringLiteral {
  type: 'Literal';
  value: string;
}

interface OxcImportSpecifier {
  type: 'ImportSpecifier';
  imported: { type: string; name: string };
}

interface OxcImportDefaultSpecifier {
  type: 'ImportDefaultSpecifier';
}

interface OxcImportNamespaceSpecifier {
  type: 'ImportNamespaceSpecifier';
}

type OxcImportSpecifierKind =
  | OxcImportSpecifier
  | OxcImportDefaultSpecifier
  | OxcImportNamespaceSpecifier;

interface OxcImportDeclaration {
  type: 'ImportDeclaration';
  source: OxcStringLiteral;
  specifiers: OxcImportSpecifierKind[];
}

interface OxcImportExpression {
  type: 'ImportExpression';
  source: OxcStringLiteral | { type: string };
}

interface OxcCallExpression {
  type: 'CallExpression';
  callee: { type: string; name?: string };
  arguments: Array<OxcStringLiteral | { type: string }>;
}

interface OxcNode {
  type: string;
  [key: string]: unknown;
}

interface OxcProgram {
  type: 'Program';
  body: OxcNode[];
}

// ─── AST walker ───────────────────────────────────────────────────────────────

function walkNode(node: OxcNode, filePath: string, symbols: ImportedSymbol[]): void {
  if (node === null || typeof node !== 'object') return;

  if (node.type === 'ImportExpression') {
    const n = node as unknown as OxcImportExpression;
    if (n.source.type === 'Literal') {
      const lit = n.source as OxcStringLiteral;
      symbols.push({
        name: '*',
        filePath,
        source: lit.value,
        isNamespace: false,
        isDynamic: true,
      } as ImportedSymbol);
    }
    // variable source — skip (can't statically resolve)
    return;
  }

  if (node.type === 'CallExpression') {
    const n = node as unknown as OxcCallExpression;
    const callee = n.callee;
    if (callee.type === 'Identifier' && callee.name === 'require') {
      const arg = n.arguments[0];
      if (arg !== undefined && arg.type === 'Literal') {
        const lit = arg as OxcStringLiteral;
        symbols.push({
          name: '*',
          filePath,
          source: lit.value,
          isNamespace: true,
          isDynamic: false,
        } as ImportedSymbol);
      }
    }
  }

  // Recurse into all object-valued properties
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item !== null && typeof item === 'object' && typeof item.type === 'string') {
          walkNode(item as OxcNode, filePath, symbols);
        }
      }
    } else if (
      child !== null &&
      typeof child === 'object' &&
      typeof (child as OxcNode).type === 'string'
    ) {
      walkNode(child as OxcNode, filePath, symbols);
    }
  }
}

// ─── Service interface ────────────────────────────────────────────────────────

export interface ImportParserShape {
  readonly parse: (
    filePath: string,
    source: string,
  ) => Effect.Effect<readonly ImportedSymbol[], ParseError>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class ImportParser extends Context.Tag('ImportParser')<ImportParser, ImportParserShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

const parseSource = (
  filePath: string,
  source: string,
): Effect.Effect<readonly ImportedSymbol[], ParseError> =>
  Effect.try({
    try: () => {
      const result = oxc.parseSync(filePath, source);

      if (result.errors.length > 0) {
        const msg = (result.errors[0] as { message?: string }).message ?? 'parse error';
        throw new Error(msg);
      }

      const program = result.program as unknown as OxcProgram;
      const symbols: ImportedSymbol[] = [];

      // Walk top-level body for static ImportDeclarations
      for (const node of program.body) {
        if (node.type === 'ImportDeclaration') {
          const n = node as unknown as OxcImportDeclaration;
          const importSource = n.source.value;

          // Skip side-effect-only imports (no specifiers)
          if (n.specifiers.length === 0) continue;

          for (const spec of n.specifiers) {
            switch (spec.type) {
              case 'ImportSpecifier': {
                const s = spec as OxcImportSpecifier;
                symbols.push({
                  name: s.imported.name,
                  filePath,
                  source: importSource,
                  isNamespace: false,
                  isDynamic: false,
                } as ImportedSymbol);
                break;
              }
              case 'ImportDefaultSpecifier': {
                symbols.push({
                  name: 'default',
                  filePath,
                  source: importSource,
                  isNamespace: false,
                  isDynamic: false,
                } as ImportedSymbol);
                break;
              }
              case 'ImportNamespaceSpecifier': {
                symbols.push({
                  name: '*',
                  filePath,
                  source: importSource,
                  isNamespace: true,
                  isDynamic: false,
                } as ImportedSymbol);
                break;
              }
            }
          }
        }
      }

      // Walk entire AST for dynamic imports and require() calls
      for (const node of program.body) {
        walkNode(node as OxcNode, filePath, symbols);
      }

      return symbols;
    },
    catch: (e) =>
      new ParseError({
        filePath,
        message: e instanceof Error ? e.message : String(e),
      }),
  });

export const ImportParserLive = Layer.succeed(ImportParser, {
  parse: parseSource,
});
