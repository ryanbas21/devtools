import { Context, Effect, Layer, Array as Arr, pipe } from 'effect';
import oxc from 'oxc-parser';
import type { ExportedSymbol } from './schemas.js';
import { ParseError } from './errors.js';

// ─── AST node types (minimal) ─────────────────────────────────────────────────

interface OxcIdent {
  type: 'Identifier';
  name: string;
  start: number;
}

interface OxcLiteral {
  type: 'Literal';
  value: unknown;
  start: number;
}

interface OxcVariableDeclarator {
  type: 'VariableDeclarator';
  id: OxcIdent | { type: string; start: number };
}

interface OxcVariableDeclaration {
  type: 'VariableDeclaration';
  start: number;
  declarations: OxcVariableDeclarator[];
}

interface OxcFunctionDeclaration {
  type: 'FunctionDeclaration';
  start: number;
  id: OxcIdent | null;
}

interface OxcClassDeclaration {
  type: 'ClassDeclaration';
  start: number;
  id: OxcIdent | null;
}

interface OxcTSTypeAlias {
  type: 'TSTypeAliasDeclaration';
  start: number;
  id: OxcIdent;
}

interface OxcTSInterface {
  type: 'TSInterfaceDeclaration';
  start: number;
  id: OxcIdent;
}

type OxcDeclaration =
  | OxcVariableDeclaration
  | OxcFunctionDeclaration
  | OxcClassDeclaration
  | OxcTSTypeAlias
  | OxcTSInterface
  | { type: string; start: number };

interface OxcExportSpecifier {
  type: 'ExportSpecifier';
  exported: OxcIdent;
  local?: OxcIdent;
  start: number;
}

interface OxcExportNamedDeclaration {
  type: 'ExportNamedDeclaration';
  start: number;
  declaration: OxcDeclaration | null;
  specifiers: OxcExportSpecifier[];
  source: OxcLiteral | null;
}

interface OxcExportDefaultDeclaration {
  type: 'ExportDefaultDeclaration';
  start: number;
}

interface OxcExportAllDeclaration {
  type: 'ExportAllDeclaration';
  start: number;
  exported: OxcIdent | null;
  source: OxcLiteral;
}

interface OxcMemberExpression {
  type: 'MemberExpression';
  object: { type: string; name?: string };
  property: OxcIdent;
}

interface OxcProperty {
  type: 'Property';
  key: OxcIdent | { type: string };
  start: number;
}

interface OxcObjectExpression {
  type: 'ObjectExpression';
  start: number;
  properties: OxcProperty[];
}

interface OxcAssignmentExpression {
  type: 'AssignmentExpression';
  start: number;
  left: OxcMemberExpression | { type: string };
  right: OxcObjectExpression | { type: string };
}

interface OxcExpressionStatement {
  type: 'ExpressionStatement';
  start: number;
  expression: OxcAssignmentExpression | { type: string };
}

type OxcBodyNode =
  | OxcExportNamedDeclaration
  | OxcExportDefaultDeclaration
  | OxcExportAllDeclaration
  | OxcExpressionStatement
  | { type: string; start: number };

interface OxcProgram {
  type: 'Program';
  body: OxcBodyNode[];
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

const lineFromOffset = (source: string, offset: number): number =>
  pipe(source.slice(0, offset).split('\n'), Arr.length);

const extractDeclarationNames = (decl: OxcDeclaration): ReadonlyArray<string> => {
  switch (decl.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration': {
      const d = decl as OxcFunctionDeclaration | OxcClassDeclaration;
      return d.id ? [d.id.name] : [];
    }
    case 'VariableDeclaration': {
      const d = decl as OxcVariableDeclaration;
      return pipe(
        d.declarations,
        Arr.flatMap((v) => (v.id.type === 'Identifier' ? [(v.id as OxcIdent).name] : [])),
      );
    }
    case 'TSTypeAliasDeclaration':
    case 'TSInterfaceDeclaration': {
      const d = decl as OxcTSTypeAlias | OxcTSInterface;
      return [d.id.name];
    }
    default:
      return [];
  }
};

const extractNamedDeclaration = (
  node: OxcExportNamedDeclaration,
  filePath: string,
  source: string,
): ReadonlyArray<ExportedSymbol> => {
  const isReExport = node.source !== null;
  const reExportSource = node.source ? String(node.source.value) : undefined;

  if (node.declaration !== null) {
    return pipe(
      extractDeclarationNames(node.declaration),
      Arr.map(
        (name): ExportedSymbol =>
          ({
            name,
            filePath,
            line: lineFromOffset(source, node.start),
            isDefault: false,
            isReExport: false,
          }) as ExportedSymbol,
      ),
    );
  }

  return pipe(
    node.specifiers,
    Arr.map((spec): ExportedSymbol => {
      const localName = (spec as { local?: OxcIdent }).local?.name;
      const isRenamed = localName !== undefined && localName !== spec.exported.name;
      return {
        name: spec.exported.name,
        filePath,
        line: lineFromOffset(source, spec.start),
        isDefault: false,
        isReExport,
        ...(reExportSource !== undefined ? { reExportSource } : {}),
        ...(isRenamed ? { reExportLocalName: localName } : {}),
      } as ExportedSymbol;
    }),
  );
};

const extractDefaultDeclaration = (
  node: OxcExportDefaultDeclaration,
  filePath: string,
  source: string,
): ReadonlyArray<ExportedSymbol> => [
  {
    name: 'default',
    filePath,
    line: lineFromOffset(source, node.start),
    isDefault: true,
    isReExport: false,
  } as ExportedSymbol,
];

const extractAllDeclaration = (
  node: OxcExportAllDeclaration,
  filePath: string,
  source: string,
): ReadonlyArray<ExportedSymbol> => [
  {
    name: node.exported ? node.exported.name : '*',
    filePath,
    line: lineFromOffset(source, node.start),
    isDefault: false,
    isReExport: true,
    reExportSource: String(node.source.value),
  } as ExportedSymbol,
];

const extractCjsExports = (
  node: OxcExpressionStatement,
  filePath: string,
  source: string,
): ReadonlyArray<ExportedSymbol> => {
  const expr = node.expression;
  if (expr.type !== 'AssignmentExpression') return [];

  const assign = expr as OxcAssignmentExpression;
  const left = assign.left;

  if (left.type !== 'MemberExpression') return [];
  const member = left as OxcMemberExpression;

  const objName =
    member.object.type === 'Identifier' ? (member.object as { name: string }).name : '';
  const propName = member.property.name;

  // exports.foo = ...
  if (objName === 'exports') {
    return [
      {
        name: propName,
        filePath,
        line: lineFromOffset(source, assign.start),
        isDefault: false,
        isReExport: false,
      } as ExportedSymbol,
    ];
  }

  // module.exports.foo = ... (nested MemberExpression)
  if (member.object.type === 'MemberExpression') {
    const inner = member.object as OxcMemberExpression;
    const innerObj =
      inner.object.type === 'Identifier' ? (inner.object as { name: string }).name : '';
    const innerProp = inner.property.name;
    if (innerObj === 'module' && innerProp === 'exports') {
      return [
        {
          name: propName,
          filePath,
          line: lineFromOffset(source, assign.start),
          isDefault: false,
          isReExport: false,
        } as ExportedSymbol,
      ];
    }
  }

  // module.exports = { foo, bar }
  if (objName === 'module' && propName === 'exports') {
    const right = assign.right;
    if (right.type !== 'ObjectExpression') return [];
    const obj = right as OxcObjectExpression;
    return pipe(
      obj.properties,
      Arr.flatMap((prop): ReadonlyArray<ExportedSymbol> => {
        if (prop.type === 'Property' && prop.key.type === 'Identifier') {
          const key = prop.key as OxcIdent;
          return [
            {
              name: key.name,
              filePath,
              line: lineFromOffset(source, prop.start),
              isDefault: false,
              isReExport: false,
            } as ExportedSymbol,
          ];
        }
        return [];
      }),
    );
  }

  return [];
};

const extractExportsFromNode = (
  node: OxcBodyNode,
  filePath: string,
  source: string,
): ReadonlyArray<ExportedSymbol> => {
  switch (node.type) {
    case 'ExportNamedDeclaration':
      return extractNamedDeclaration(node as OxcExportNamedDeclaration, filePath, source);
    case 'ExportDefaultDeclaration':
      return extractDefaultDeclaration(node as OxcExportDefaultDeclaration, filePath, source);
    case 'ExportAllDeclaration':
      return extractAllDeclaration(node as OxcExportAllDeclaration, filePath, source);
    case 'ExpressionStatement':
      return extractCjsExports(node as OxcExpressionStatement, filePath, source);
    default:
      return [];
  }
};

// ─── Service interface ────────────────────────────────────────────────────────

export interface ExportParserShape {
  readonly parse: (
    filePath: string,
    source: string,
  ) => Effect.Effect<readonly ExportedSymbol[], ParseError>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class ExportParser extends Context.Tag('ExportParser')<ExportParser, ExportParserShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

const parseSource = (
  filePath: string,
  source: string,
): Effect.Effect<readonly ExportedSymbol[], ParseError> =>
  Effect.try({
    try: () => {
      const result = oxc.parseSync(filePath, source);

      if (result.errors.length > 0) {
        const msg = (result.errors[0] as { message?: string }).message ?? 'parse error';
        throw new Error(msg);
      }

      const program = result.program as unknown as OxcProgram;

      return pipe(
        program.body,
        Arr.flatMap((node) => extractExportsFromNode(node, filePath, source)),
      );
    },
    catch: (e) =>
      new ParseError({
        filePath,
        message: e instanceof Error ? e.message : String(e),
      }),
  });

export const ExportParserLive = Layer.succeed(ExportParser, {
  parse: parseSource,
});
