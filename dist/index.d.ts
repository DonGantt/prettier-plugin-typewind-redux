import { Plugin, Parser } from 'prettier';

declare const plugin: Plugin;
declare const parsers: {
    [parserName: string]: Parser<any>;
} | undefined;

export { plugin as default, parsers };
