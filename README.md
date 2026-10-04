# prettier-plugin-typewind-redux

A Prettier plugin for [typewind](https://github.com/Mokshit06/typewind) and [typewind-v4](https://github.com/DonGantt/typewind), the zero-runtime, type-safe Tailwind CSS wrapper — for projects on either Tailwind v3 (`typewind`) or Tailwind v4 (`typewind-v4`).

Sorts consecutive `tw.<prop>` chains into the same canonical order Tailwind CSS itself registers its utilities in — the equivalent of `prettier-plugin-tailwindcss`'s class sorting, but for typewind's typed `tw.` API instead of string class lists.

## Installation

```sh
npm install --save-dev prettier-plugin-typewind-redux
```

```sh
pnpm add --save-dev prettier-plugin-typewind-redux
```

```sh
yarn add --dev prettier-plugin-typewind-redux
```

```sh
bun add --dev prettier-plugin-typewind-redux
```

Requires Prettier 3+, and works with either `typewind` (Tailwind v3) or `typewind-v4` (Tailwind v4) — whichever is installed.

## Usage

Add it to your Prettier config's `plugins` list:

```json
{
  "plugins": ["prettier-plugin-typewind-redux"]
}
```

```js
// before
const styles = tw.items_center.flex.justify_center;

// after
const styles = tw.flex.items_center.justify_center;
```

## How it works

The plugin needs the canonical utility order Tailwind itself generates:

- **typewind-v4 projects**: it reads the generated `dist/_metadata.json` (run the typewind-v4 CLI generator first).
- **typewind (v3) projects**: no extra step — it builds the equivalent order on the fly from your `tailwind.config.{js,cjs,mjs}` the first time it's needed, then caches it and rebuilds automatically if the config file's mtime changes. A `tailwind.config.mjs` written as genuine ESM requires Node 20.19+/22.12+ — on older Node it's silently treated the same as "no config found".

Either way, it then wraps Prettier's `babel`, `babel-ts`, and `typescript` parsers to reorder runs of plain `tw.<prop>` member accesses after parsing.

It deliberately does **not** reorder:

- Across a method call boundary (`tw.flex.hover(...)`) — variant call order can be semantically meaningful.
- Across an arbitrary bracket value (`tw.gap_['12px']`).
- Across a link where `?.` actually appears in an optional chain — reordering there could change which property access short-circuits at runtime.

If neither metadata source is available, the plugin leaves code untouched rather than erroring.

## License

MIT
