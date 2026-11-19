import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Result } from '../lib/result';
import type { Result as StateResult } from './state';

const ENGINE_DIR = fileURLToPath(new URL('.', import.meta.url));
const ALLOWED_LIB_MODULES = new Set([
  '../lib/types',
  '../lib/date',
  '../lib/random',
  '../lib/result',
]);
const FORBIDDEN_IDENTIFIERS = new Set([
  'localStorage',
  'document',
  'window',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'crypto',
]);

function collectEngineSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectEngineSources(full);
    }

    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      return [full];
    }

    return [];
  });
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

function importIsRuntime(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;

  if (clause === undefined) {
    return true;
  }

  if (clause.isTypeOnly) {
    return false;
  }

  if (clause.name !== undefined) {
    return true;
  }

  const bindings = clause.namedBindings;

  if (bindings === undefined) {
    return true;
  }

  if (ts.isNamespaceImport(bindings)) {
    return true;
  }

  return bindings.elements.some((element) => !element.isTypeOnly);
}

function exportIsRuntime(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) {
    return false;
  }

  if (node.exportClause === undefined) {
    return true;
  }

  if (ts.isNamespaceExport(node.exportClause)) {
    return true;
  }

  return node.exportClause.elements.some((element) => !element.isTypeOnly);
}

function moduleViolation(
  file: string,
  source: ts.SourceFile,
  node: ts.Node,
  specifier: string,
  isRuntime: boolean
): string | null {
  const location = source.getLineAndCharacterOfPosition(node.getStart(source));
  const where = `${relative(ENGINE_DIR, file)}:${location.line + 1}`;

  if (specifier.startsWith('./')) {
    return null;
  }

  if (specifier === '../lib/penalty-notice') {
    return isRuntime ? `${where}: runtime import from ${specifier}` : null;
  }

  if (ALLOWED_LIB_MODULES.has(specifier)) {
    return null;
  }

  return `${where}: forbidden module import ${specifier}`;
}

function collectModuleViolations(file: string, source: ts.SourceFile): string[] {
  const violations: string[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const violation = moduleViolation(
        file,
        source,
        statement,
        statement.moduleSpecifier.text,
        importIsRuntime(statement)
      );

      if (violation !== null) {
        violations.push(violation);
      }
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) {
        const violation = moduleViolation(
          file,
          source,
          statement,
          statement.moduleSpecifier.text,
          exportIsRuntime(statement)
        );

        if (violation !== null) {
          violations.push(violation);
        }
      }
    }
  }

  return violations;
}

function collectRuntimeViolations(file: string, source: ts.SourceFile): string[] {
  const violations: string[] = [];

  const report = (node: ts.Node, message: string): void => {
    const location = source.getLineAndCharacterOfPosition(node.getStart(source));

    violations.push(`${relative(ENGINE_DIR, file)}:${location.line + 1}: ${message}`);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
      report(node, `runtime API ${node.text}`);
    }

    if (ts.isPropertyAccessExpression(node)) {
      const object = node.expression;

      if (ts.isIdentifier(object) && object.text === 'Date' && node.name.text === 'now') {
        report(node, 'runtime API Date.now');
      }

      if (ts.isIdentifier(object) && object.text === 'Math' && node.name.text === 'random') {
        report(node, 'runtime API Math.random');
      }
    }

    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Date' &&
      (node.arguments?.length ?? 0) === 0
    ) {
      report(node, 'runtime API new Date() without arguments');
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return violations;
}

const engineSources = collectEngineSources(ENGINE_DIR);

describe('engine purity', () => {
  it('imports only its own modules and the allowed lib helpers', () => {
    const violations = engineSources.flatMap((file) => collectModuleViolations(file, parse(file)));

    expect(violations).toEqual([]);
  });

  it('uses no clock, randomness, DOM, storage, or timers', () => {
    const violations = engineSources.flatMap((file) => collectRuntimeViolations(file, parse(file)));

    expect(violations).toEqual([]);
  });
});

describe('Result contract', () => {
  it('is shared from lib/result and re-exported by engine/state', () => {
    const resultSource = parse(join(ENGINE_DIR, '..', 'lib', 'result.ts'));
    const stateSource = parse(join(ENGINE_DIR, 'state.ts'));
    const resultAlias = resultSource.statements.find(
      (statement): statement is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Result'
    );

    expect(resultAlias).toBeDefined();

    const sharedImport = stateSource.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === '../lib/result' &&
        statement.importClause?.isTypeOnly === true &&
        statement.importClause.namedBindings !== undefined &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        statement.importClause.namedBindings.elements.some(
          (element) => element.name.text === 'Result'
        )
    );
    const reExport = stateSource.statements.find(
      (statement): statement is ts.ExportDeclaration =>
        ts.isExportDeclaration(statement) &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some((element) => element.name.text === 'Result')
    );

    expect(sharedImport).toBe(true);
    expect(reExport).toBeDefined();
  });

  it('keeps the same success and error shape through the re-export', () => {
    expectTypeOf<StateResult<number, 'ERR'>>().toEqualTypeOf<Result<number, 'ERR'>>();
    expectTypeOf<Result<number, 'ERR'>>().toEqualTypeOf<
      { ok: true; value: number } | { ok: false; error: 'ERR' }
    >();
  });
});
