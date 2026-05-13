import { Context, Effect, Layer, Array as Arr, pipe } from 'effect';
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

// ─── Pure extractors ─────────────────────────────────────────────────────────

const extractSpecifier = (
  spec: OxcImportSpecifierKind,
  filePath: string,
  importSource: string,
): ReadonlyArray<ImportedSymbol> => {
  switch (spec.type) {
    case 'ImportSpecifier': {
      const s = spec as OxcImportSpecifier;
      return [
        {
          name: s.imported.name,
          filePath,
          source: importSource,
          isNamespace: false,
          isDynamic: false,
        } as ImportedSymbol,
      ];
    }
    case 'ImportDefaultSpecifier':
      return [
        {
          name: 'default',
          filePath,
          source: importSource,
          isNamespace: false,
          isDynamic: false,
        } as ImportedSymbol,
      ];
    case 'ImportNamespaceSpecifier':
      return [
        {
          name: '*',
          filePath,
          source: importSource,
          isNamespace: true,
          isDynamic: false,
        } as ImportedSymbol,
      ];
    default:
      return [];
  }
};

const extractStaticImports = (node: OxcNode, filePath: string): ReadonlyArray<ImportedSymbol> => {
  if (node.type !== 'ImportDeclaration') return [];
  const n = node as unknown as OxcImportDeclaration;
  if (n.specifiers.length === 0) return [];

  return pipe(
    n.specifiers,
    Arr.flatMap((spec) => extractSpecifier(spec, filePath, n.source.value)),
  );
};

const collectSymbols = (node: OxcNode, filePath: string): ReadonlyArray<ImportedSymbol> => {
  if (node === null || typeof node !== 'object') return [];

  if (node.type === 'ImportExpression') {
    const n = node as unknown as OxcImportExpression;
    if (n.source.type === 'Literal') {
      const lit = n.source as OxcStringLiteral;
      return [
        {
          name: '*',
          filePath,
          source: lit.value,
          isNamespace: false,
          isDynamic: true,
        } as ImportedSymbol,
      ];
    }
    return [];
  }

  const currentSymbols: ReadonlyArray<ImportedSymbol> =
    node.type === 'CallExpression'
      ? extractRequireCall(node as unknown as OxcCallExpression, filePath)
      : [];

  const childSymbols = pipe(
    Object.keys(node),
    Arr.flatMap((key): ReadonlyArray<ImportedSymbol> => {
      const child = node[key];
      if (Array.isArray(child)) {
        return pipe(
          child,
          Arr.filter(
            (item): item is OxcNode =>
              item !== null && typeof item === 'object' && typeof item.type === 'string',
          ),
          Arr.flatMap((item) => collectSymbols(item, filePath)),
        );
      }
      if (
        child !== null &&
        typeof child === 'object' &&
        typeof (child as OxcNode).type === 'string'
      ) {
        return collectSymbols(child as OxcNode, filePath);
      }
      return [];
    }),
  );

  return pipe(currentSymbols, Arr.appendAll(childSymbols));
};

const extractRequireCall = (
  node: OxcCallExpression,
  filePath: string,
): ReadonlyArray<ImportedSymbol> => {
  const callee = node.callee;
  if (callee.type === 'Identifier' && callee.name === 'require') {
    const arg = node.arguments[0];
    if (arg !== undefined && arg.type === 'Literal') {
      const lit = arg as OxcStringLiteral;
      return [
        {
          name: '*',
          filePath,
          source: lit.value,
          isNamespace: true,
          isDynamic: false,
        } as ImportedSymbol,
      ];
    }
  }
  return [];
};

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

      const staticImports = pipe(
        program.body,
        Arr.flatMap((node) => extractStaticImports(node as OxcNode, filePath)),
      );

      const dynamicImports = pipe(
        program.body,
        Arr.flatMap((node) => collectSymbols(node as OxcNode, filePath)),
      );

      return pipe(staticImports, Arr.appendAll(dynamicImports));
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
