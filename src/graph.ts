import * as acorn from "acorn";
import MagicString from "magic-string";
import { ILoadResult } from "./plugin";
import { Ident, Scope } from './scope'


export interface IModuleGraphNode {
  path: string;
  exports: ModuleGraphExport[];
  export_nodes: acorn.Node[];
  imports: ModuleGraphImport[];
  import_nodes: acorn.Node[];
  code: MagicString
  import_idents: Map<ModuleGraphImportSpecifier, Ident>;
  scope: Scope;
  magic: MagicString;
  source: ILoadResult;
  node: acorn.Node;
  static_deps: Set<string>;
  circular: Map<string, IModuleGraphNode>;
  children: Map<string, IModuleGraphNode>;
}

export type ModuleGraphExport = IModuleGraphLocalExport | IModuleGraphReferenceExport

export interface IModuleGraphLocalExport {
  node: acorn.Node;
  specifiers: ModuleGraphExportSpecifier[];
  local: true
}

export interface IModuleGraphReferenceExport {
  node: acorn.Node;
  specifiers: ModuleGraphExportSpecifier[];
  source?: string;
  local: false;
  code: MagicString;
}

export type ModuleGraphExportSpecifier = 
  | IModuleGraphExportSpecifierAll
  | IModuleGraphExportSpecifierDefault
  | IModuleGraphExportSpecifierNamed
  | IModuleGraphExportSpecifierNamedDecl

export interface IModuleGraphExportSpecifierDefault {
  type: "default";
  decl: acorn.Node;
  node: acorn.Node;
}

export interface IModuleGraphExportSpecifierAll {
  type: "all";
  exported: MagicString;
  node: acorn.Node;
}

export interface IModuleGraphExportSpecifierNamed {
  type: "named";
  local: MagicString;
  exported: MagicString;
  node: acorn.Node;
}

export interface IModuleGraphExportSpecifierNamedDecl {
  type: "named-decl";
  decl: acorn.Node;
  node: acorn.Node;
  local_node: acorn.Node | acorn.Node[];
  local: MagicString | MagicString[];
}

export type ModuleGraphImport = IModuleGraphExprImport | IModuleGraphStaticImport

export interface IModuleGraphExprImport {
  node: acorn.Node;
  static: false;
  specifiers: never[];
  source: acorn.Node;
}

export interface IModuleGraphStaticImport {
  node: acorn.Node;
  specifiers: ModuleGraphImportSpecifier[];
  static: true;
  source: string;
  code: MagicString;
}

export type ModuleGraphImportSpecifier = 
  | IModuleGraphImportSpecifierAll
  | IModuleGraphImportSpecifierNamed
  | IModuleGraphImportSpecifierDefault

export interface IModuleGraphImportSpecifierAll {
  type: "all";
  local: MagicString;
  node: acorn.Node;
}

export interface IModuleGraphImportSpecifierNamed {
  type: "named";
  local: MagicString;
  imported: MagicString;
  node: acorn.Node;
}

export interface IModuleGraphImportSpecifierDefault {
  type: "default";
  local: MagicString;
  node: acorn.Node;
}
