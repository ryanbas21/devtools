import { Context, Effect, Layer } from 'effect';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lineFromOffset(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function extractDeclarationNames(decl: OxcDeclaration): string[] {
  switch (decl.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration': {
      const d = decl as OxcFunctionDeclaration | OxcClassDeclaration;
      return d.id ? [d.id.name] : [];
    }
    case 'VariableDeclaration': {
      const d = decl as OxcVariableDeclaration;
      return d.declarations.flatMap((v) =>
        v.id.type === 'Identifier' ? [(v.id as OxcIdent).name] : [],
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
}

function extractCjsExports(
  node: OxcExpressionStatement,
  filePath: string,
  source: string,
): ExportedSymbol[] {
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

  // module.exports.foo = ...  (nested MemberExpression)
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
    return obj.properties.flatMap((prop) => {
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
    });
  }

  return [];
}

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
      const symbols: ExportedSymbol[] = [];

      for (const node of program.body) {
        switch (node.type) {
          case 'ExportNamedDeclaration': {
            const n = node as OxcExportNamedDeclaration;
            const isReExport = n.source !== null;
            const reExportSource = n.source ? String(n.source.value) : undefined;

            if (n.declaration !== null) {
              // export const foo = ..., export function bar() {}, etc.
              const names = extractDeclarationNames(n.declaration);
              for (const name of names) {
                symbols.push({
                  name,
                  filePath,
                  line: lineFromOffset(source, n.start),
                  isDefault: false,
                  isReExport: false,
                } as ExportedSymbol);
              }
            } else {
              // export { foo, bar } or export { foo } from './other'
              for (const spec of n.specifiers) {
                const localName = (spec as { local?: OxcIdent }).local?.name;
                const isRenamed = localName !== undefined && localName !== spec.exported.name;
                symbols.push({
                  name: spec.exported.name,
                  filePath,
                  line: lineFromOffset(source, spec.start),
                  isDefault: false,
                  isReExport,
                  ...(reExportSource !== undefined ? { reExportSource } : {}),
                  ...(isRenamed ? { reExportLocalName: localName } : {}),
                } as ExportedSymbol);
              }
            }
            break;
          }

          case 'ExportDefaultDeclaration': {
            const n = node as OxcExportDefaultDeclaration;
            symbols.push({
              name: 'default',
              filePath,
              line: lineFromOffset(source, n.start),
              isDefault: true,
              isReExport: false,
            } as ExportedSymbol);
            break;
          }

          case 'ExportAllDeclaration': {
            const n = node as OxcExportAllDeclaration;
            const name = n.exported ? n.exported.name : '*';
            symbols.push({
              name,
              filePath,
              line: lineFromOffset(source, n.start),
              isDefault: false,
              isReExport: true,
              reExportSource: String(n.source.value),
            } as ExportedSymbol);
            break;
          }

          case 'ExpressionStatement': {
            const n = node as OxcExpressionStatement;
            const cjsExports = extractCjsExports(n, filePath, source);
            symbols.push(...cjsExports);
            break;
          }

          default:
            break;
        }
      }

      return symbols;
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
