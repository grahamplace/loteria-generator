/** Node adapter for the exact browser canvas renderer, used only for sample assets/tests. */
import { createCanvas, Image, GlobalFonts } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function installCanvasRuntime() {
  const css = await readFile(resolve('app/globals.css'), 'utf8');
  const tokens = new Map(
    [...css.matchAll(/(--loteria-[a-z-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ])
  );
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.Image = Image;
  globals.document = {
    documentElement: {},
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`Unsupported element ${tag}`);
      return createCanvas(1, 1);
    },
    fonts: { add() {} },
  };
  globals.getComputedStyle = () => ({
    getPropertyValue: (token: string) => tokens.get(token) ?? '',
  });
  globals.FontFace = class {
    constructor(
      public family: string,
      public source: string
    ) {}
    async load() {
      const path = resolve('public', this.source.slice(4, -1).replace(/^\//, ''));
      if (!GlobalFonts.registerFromPath(path, this.family))
        throw new Error(`Could not load ${this.family}`);
      return this;
    }
  };
}
