import { SourceMap } from 'magic-string'
import * as acorn from 'acorn'

export interface IPlugin {
  name: string;
  load(id: string, read: () => Promise<Buffer>): Promise<ILoadResult | null> | ILoadResult | null;
  resolve(
    id: string,
    importer?: string,
    options?: IPluginResolveOptions
  ): Promise<string | null> | string | null;
  parse(input: string, options?: acorn.Options): acorn.Node | Promise<acorn.Node> | null | Promise<null>;
  transform(source: ILoadResult, id: string): TransformResult | Promise<TransformResult> | null
}

export type Plugin = Partial<IPlugin>

export type TransformResult = string | null | undefined | Partial<ILoadResult>;

export interface ILoadResult {
  code: string;
  ast?: acorn.Node;
  map?: SourceMap;
}

export interface IPluginResolveOptions {
  entry: boolean;
}