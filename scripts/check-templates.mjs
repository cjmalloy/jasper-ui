#!/usr/bin/env node
// Fails when a component template (or host binding) reads change-detection state that OnPush will not track:
//   1. a Signal / InputSignal / ModelSignal read without being called, e.g. `@if (editing)` or `[class.x]="busy"`
//   2. FormControl / AbstractControl `.value`, `.valid`, `.invalid` or `.errors` (use `controlValue()` from util/form.ts)
//   3. DOM state of a template reference (`#input` then `[title]="input.value"`), which changes without notifying Angular
// Templates are parsed with @angular/compiler and every expression is resolved with the TypeScript type checker.
// Exceptions go in scripts/check-templates.allowlist.json, and each one needs a reason.
import {
  AST,
  ASTWithSource,
  BindingType,
  Call,
  ImplicitReceiver,
  KeyedRead,
  Lexer,
  LiteralPrimitive,
  NonNullAssert,
  ParsedEventType,
  ParseLocation,
  ParseSourceFile,
  ParseSourceSpan,
  Parser,
  parseTemplate,
  PropertyRead,
  SafeCall,
  SafeKeyedRead,
  SafePropertyRead,
  ThisReceiver,
  TmplAstLetDeclaration,
  TmplAstRecursiveVisitor,
  tmplAstVisitAll,
} from '@angular/compiler';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowlistFile = resolve(root, 'scripts/check-templates.allowlist.json');
const CONTROL_STATE = new Set(['value', 'valid', 'invalid', 'errors', 'status', 'pending', 'dirty', 'pristine', 'touched', 'untouched', 'disabled', 'enabled']);
const CONTROL_CLASSES = new Set(['AbstractControl', 'FormControl', 'FormGroup', 'FormArray', 'FormRecord']);
const DOM_STATE = new Set(['value', 'checked', 'valueAsNumber', 'valueAsDate', 'selectedIndex']);

const configFile = ts.readConfigFile(resolve(root, 'tsconfig.app.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const elementTagMap = findElementTagMap();

const allowlist = existsSync(allowlistFile) ? JSON.parse(readFileSync(allowlistFile, 'utf8')) : [];
const allowUsed = new Set();
const problems = [];
let checked = 0;

for (const entry of allowlist) {
  if (!entry.file || !entry.expression || !entry.reason?.trim()) {
    problems.push(`${relative(root, allowlistFile)}: every entry needs "file", "expression" and a non-empty "reason": ${JSON.stringify(entry)}`);
  }
}

function checkClass(sf, cls) {
  for (const decorator of ts.getDecorators(cls) || []) {
    const call = decorator.expression;
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) continue;
    if (!['Component', 'Directive'].includes(call.expression.text)) continue;
    const meta = call.arguments[0];
    if (!meta || !ts.isObjectLiteralExpression(meta)) continue;
    const ctx = { sf, cls, classType: checker.getTypeAtLocation(cls) };
    for (const prop of meta.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = prop.name.getText(sf);
      const init = prop.initializer;
      if (key === 'template' && ts.isStringLiteralLike(init)) {
        checkTemplate(ctx, init.text, { file: sf.fileName, fileText: sf.text, offset: init.getStart(sf) + 1 });
      } else if (key === 'templateUrl' && ts.isStringLiteralLike(init)) {
        const file = resolve(dirname(sf.fileName), init.text);
        const text = readFileSync(file, 'utf8');
        checkTemplate(ctx, text, { file, fileText: text, offset: 0 });
      } else if (key === 'host' && ts.isObjectLiteralExpression(init)) {
        checkHost(ctx, init);
      }
    }
  }
}

function checkTemplate(ctx, template, loc) {
  checked++;
  const { nodes, errors } = parseTemplate(template, loc.file, { preserveWhitespaces: false });
  if (errors?.length) {
    problems.push(...errors.map(e => `${relative(root, loc.file)}: ${e}`));
    return;
  }
  const scope = new Map();
  collectReferences(nodes, scope);
  new TemplateWalker(ctx, loc, scope).visitNodes(nodes);
}

function checkHost(ctx, host) {
  const parser = new Parser(new Lexer());
  const sf = ctx.sf;
  for (const prop of host.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteralLike(prop.initializer)) continue;
    const key = ts.isStringLiteralLike(prop.name) ? prop.name.text : prop.name.getText(sf);
    const value = prop.initializer.text;
    const span = sourceSpan(value, sf.fileName);
    let ast;
    if (key.startsWith('[')) ast = parser.parseBinding(value, span, 0);
    else if (key.startsWith('(')) ast = parser.parseAction(value, span, 0);
    else continue;
    checked++;
    const loc = { file: sf.fileName, fileText: sf.text, offset: prop.initializer.getStart(sf) + 1 };
    checkExpression(ctx, loc, new Map(), ast, { event: key.startsWith('(') });
  }
}

function sourceSpan(text, url) {
  const file = new ParseSourceFile(text, url);
  return new ParseSourceSpan(new ParseLocation(file, 0, 0, 0), new ParseLocation(file, text.length, 0, text.length));
}

/**
 * Template reference variables (#ref) are visible everywhere. References to plain elements are typed
 * as the DOM element, everything else (directives, components, ng-template) is untyped.
 */
function collectReferences(nodes, scope) {
  class RefCollector extends TmplAstRecursiveVisitor {
    visitElement(el) {
      el.references.forEach(r => scope.set(r.name, r.value ? undefined : domElementType(el.name)));
      super.visitElement(el);
    }
    visitTemplate(t) { t.references.forEach(r => scope.set(r.name, undefined)); super.visitTemplate(t); }
    visitComponent(c) { c.references?.forEach(r => scope.set(r.name, undefined)); super.visitComponent(c); }
  }
  tmplAstVisitAll(new RefCollector(), nodes);
}

class TemplateWalker extends TmplAstRecursiveVisitor {
  constructor(ctx, loc, scope) {
    super();
    this.ctx = ctx;
    this.loc = loc;
    this.scope = scope;
  }

  visitNodes(nodes, vars = []) {
    const parent = this.scope;
    this.scope = new Map(parent);
    for (const [name, type] of vars) this.scope.set(name, type);
    for (const node of nodes) {
      if (node instanceof TmplAstLetDeclaration) this.scope.set(node.name, undefined);
    }
    tmplAstVisitAll(this, nodes);
    this.scope = parent;
  }

  check(ast, opts = {}) {
    if (ast) checkExpression(this.ctx, this.loc, this.scope, ast, opts);
  }

  visitAttrs(node) {
    tmplAstVisitAll(this, node.templateAttrs || []);
    tmplAstVisitAll(this, node.inputs);
    tmplAstVisitAll(this, node.outputs);
    tmplAstVisitAll(this, node.directives || []);
  }

  visitElement(el) { this.visitAttrs(el); this.visitNodes(el.children); }
  visitComponent(c) { this.visitAttrs(c); this.visitNodes(c.children); }
  visitTemplate(t) { this.visitAttrs(t); this.visitNodes(t.children, t.variables.map(v => [v.name, undefined])); }

  visitBoundAttribute(attr) { this.check(attr.value, { twoWay: attr.type === BindingType.TwoWay }); }
  visitBoundEvent(event) { this.check(event.handler, { twoWay: event.type === ParsedEventType.TwoWay, event: true }); }
  visitBoundText(text) { this.check(text.value); }

  visitIfBlockBranch(branch) {
    this.check(branch.expression);
    const vars = branch.expressionAlias
      ? [[branch.expressionAlias.name, nonNull(evalType(this.ctx, this.scope, branch.expression))]]
      : [];
    this.visitNodes(branch.children, vars);
  }

  visitForLoopBlock(block) {
    this.check(block.expression);
    const item = elementType(evalType(this.ctx, this.scope, block.expression));
    const vars = [[block.item.name, item], ...block.contextVariables.map(v => [v.name, undefined])];
    const parent = this.scope;
    this.scope = new Map(parent);
    for (const [name, type] of vars) this.scope.set(name, type);
    this.check(block.trackBy);
    this.scope = parent;
    this.visitNodes(block.children, vars);
    if (block.empty) this.visitNodes(block.empty.children);
  }

  visitSwitchBlock(block) {
    this.check(block.expression);
    for (const group of block.groups || []) {
      for (const c of group.cases) this.check(c.expression);
      this.visitNodes(group.children);
    }
  }

  visitLetDeclaration(decl) {
    this.check(decl.value);
    this.scope.set(decl.name, evalType(this.ctx, this.scope, decl.value));
  }

  visitDeferredBlock(block) {
    for (const trigger of [...Object.values(block.triggers || {}), ...Object.values(block.prefetchTriggers || {})]) {
      if (trigger?.value) this.check(trigger.value);
    }
    this.visitNodes(block.children);
    for (const sub of [block.placeholder, block.loading, block.error]) {
      if (sub) this.visitNodes(sub.children);
    }
  }

  visitIcu(icu) {
    for (const v of Object.values(icu.vars || {})) this.check(v.value);
    for (const p of Object.values(icu.placeholders || {})) if (p.value) this.check(p.value);
  }
}

/**
 * Event handlers only run when the event fires, so reading form control state there is fine.
 * Uncalled signals are still bugs in handlers.
 */
function checkExpression(ctx, loc, scope, ast, { twoWay = false, event = false } = {}) {
  const top = ast instanceof ASTWithSource ? ast.ast : ast;
  walk(top, null);

  function walk(node, parent) {
    if (node instanceof ASTWithSource) return walk(node.ast, parent);
    if (!(node instanceof AST)) return;
    if (node instanceof PropertyRead || node instanceof SafePropertyRead) checkRead(node, parent);
    for (const value of Object.values(node)) {
      if (value instanceof AST) walk(value, node);
      else if (Array.isArray(value)) value.forEach(v => walk(v, node));
    }
  }

  function checkRead(node, parent) {
    const type = evalType(ctx, scope, node);
    if (type && isSignal(type)) {
      const called = (parent instanceof Call || parent instanceof SafeCall) && parent.receiver === node;
      const member = (parent instanceof PropertyRead || parent instanceof SafePropertyRead) && parent.receiver === node;
      if (!called && !member && !(twoWay && node === top)) {
        report(node, `signal '${source(node)}' is read without calling it`);
      }
    }
    if (!event && DOM_STATE.has(node.name)) {
      const receiver = nonNull(evalType(ctx, scope, node.receiver));
      if (receiver && isDomElement(receiver)) {
        report(node, `'${source(node)}' reads DOM state that Angular does not track; bind to a signal or form control instead`);
      }
    }
    if (!event && CONTROL_STATE.has(node.name)) {
      const receiver = nonNull(evalType(ctx, scope, node.receiver));
      const prop = receiver && checker.getPropertyOfType(receiver, node.name);
      if (prop && isControlMember(prop)) {
        report(node, `'${source(node)}' reads form control state that OnPush does not track; use controlValue() or a signal`);
      }
    }
  }

  function source(node) {
    const span = node.sourceSpan;
    return span ? loc.fileText.slice(loc.offset + span.start, loc.offset + span.end).trim() : node.name;
  }

  function report(node, message) {
    const file = relative(root, loc.file);
    const expression = source(node);
    const index = allowlist.findIndex(e => e.file === file && e.expression === expression && e.reason?.trim());
    if (index >= 0) {
      allowUsed.add(index);
      return;
    }
    const lines = loc.fileText.slice(0, loc.offset + (node.sourceSpan?.start ?? 0)).split('\n');
    problems.push(`${file}:${lines.length}:${lines.at(-1).length + 1} [${ctx.cls.name?.text}] ${message}`);
  }
}

function evalType(ctx, scope, node) {
  if (!node) return undefined;
  if (node instanceof ASTWithSource) return evalType(ctx, scope, node.ast);
  if (node instanceof ImplicitReceiver) return ctx.classType;
  if (node instanceof NonNullAssert) return nonNull(evalType(ctx, scope, node.expression));
  if (node instanceof PropertyRead || node instanceof SafePropertyRead) {
    if (node.receiver instanceof ImplicitReceiver && !(node.receiver instanceof ThisReceiver) && scope.has(node.name)) {
      return scope.get(node.name);
    }
    return memberType(ctx, evalType(ctx, scope, node.receiver), node.name);
  }
  if (node instanceof KeyedRead || node instanceof SafeKeyedRead) {
    const receiver = nonNull(evalType(ctx, scope, node.receiver));
    if (!receiver) return undefined;
    if (node.key instanceof LiteralPrimitive && typeof node.key.value === 'string') {
      return memberType(ctx, receiver, node.key.value);
    }
    return checker.getIndexTypeOfType(receiver, ts.IndexKind.Number)
      ?? checker.getIndexTypeOfType(receiver, ts.IndexKind.String);
  }
  if (node instanceof Call || node instanceof SafeCall) {
    const fn = nonNull(evalType(ctx, scope, node.receiver));
    return fn && checker.getSignaturesOfType(fn, ts.SignatureKind.Call)[0]?.getReturnType();
  }
  return undefined;
}

function memberType(ctx, type, name) {
  type = nonNull(type);
  const prop = type && checker.getPropertyOfType(type, name);
  return prop ? checker.getTypeOfSymbolAtLocation(prop, ctx.cls) : undefined;
}

function elementType(type) {
  type = nonNull(type);
  return type && checker.getIndexTypeOfType(type, ts.IndexKind.Number);
}

function nonNull(type) {
  return type && checker.getNonNullableType(type);
}

function isSignal(type) {
  type = nonNull(type);
  const types = type.isUnion() ? type.types : [type];
  return types.some(t => t.getProperties().some(p => String(p.escapedName).startsWith('__@SIGNAL@')));
}

function isControlMember(prop) {
  return (prop.declarations || []).some(d => {
    const owner = d.parent;
    return owner && (ts.isClassDeclaration(owner) || ts.isInterfaceDeclaration(owner))
      && CONTROL_CLASSES.has(owner.name?.text)
      && d.getSourceFile().fileName.includes('@angular/forms');
  });
}

function findElementTagMap() {
  for (const sf of program.getSourceFiles()) {
    if (!sf.isDeclarationFile || !sf.fileName.includes('lib.dom')) continue;
    const decl = sf.statements.find(st => ts.isInterfaceDeclaration(st) && st.name.text === 'HTMLElementTagNameMap');
    if (decl) return checker.getTypeAtLocation(decl.name);
  }
  return undefined;
}

function domElementType(tag) {
  const prop = elementTagMap && checker.getPropertyOfType(elementTagMap, tag.toLowerCase());
  return prop ? checker.getTypeOfSymbol(prop) : undefined;
}

function isDomElement(type) {
  return !!type.getProperty('tagName') && !!type.getProperty('ownerDocument');
}

function main() {
  const srcDir = resolve(root, 'src') + sep;
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || !resolve(sf.fileName).startsWith(srcDir) || sf.fileName.endsWith('.spec.ts')) continue;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isClassDeclaration(node)) checkClass(sf, node);
      ts.forEachChild(node, visit);
    });
  }

  allowlist.forEach((entry, i) => {
    if (!allowUsed.has(i)) problems.push(`${relative(root, allowlistFile)}: unused entry ${JSON.stringify(entry)}`);
  });

  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} template problem(s). Call signals in templates, and read form state through controlValue() or a signal.`);
    process.exit(1);
  }
  console.log(`check-templates: ${checked} templates and host bindings OK`);
}

main();
