# sanity-plugin-image-resizer

> This is a **Sanity Studio v3** plugin.

Batch-optimise image assets in your Sanity dataset. Scans all `sanity.imageAsset` documents for constraint violations (TIFF format, oversized width or filesize) and lets editors resize, compress and convert them in-place — re-encoding via the Sanity Image API, uploading the optimised version, re-linking all references and cleaning up the old asset.

## Features

- **Format conversion** — TIFF → WebP (or JPG), optional PNG → WebP
- **Resize** — caps images to a configurable max width
- **Compress** — progressively lowers quality until the file fits within the size budget
- **Batch processing** — process all violating assets in parallel
- **Reference patching** — automatically updates every document referencing the old asset
- **Configurable** — override accepted types, max size and max width from plugin config
- **Validation helper** — export a `validateImageSize` custom validator for your schemas

## Installation

```sh
npm install sanity-plugin-image-resizer
```

## Usage

Add it as a plugin in `sanity.config.ts` (or .js):

```ts
import { defineConfig } from 'sanity'
import { imageResizerPlugin } from 'sanity-plugin-image-resizer'

export default defineConfig({
  // ...
  plugins: [
    imageResizerPlugin({
      // All options are optional — these are the defaults:
      imageAccept: 'image/jpeg, image/png, image/gif, image/webp',
      imageMaxSize: 20 * 1024 * 1024, // 20 MB
      imageMaxWidth: 6000,
    }),
  ],
})
```

### Image validation in schemas

The plugin exports a `validateImageSize` custom validator you can attach to any image field to enforce the same constraints at document level:

```ts
import { defineType, defineField } from 'sanity'
import { validateImageSize } from 'sanity-plugin-image-resizer'

export default defineType({
  name: 'myDocument',
  type: 'document',
  fields: [
    defineField({
      name: 'photo',
      type: 'image',
      validation: (rule) => rule.custom(validateImageSize),
    }),
  ],
})
```

### Using the tool

1. Open your Sanity Studio.
2. Navigate to the **Image Optimiser** tool in the Studio sidebar.
3. The tool automatically scans all image assets and shows those violating constraints.
4. Click **Process All** to batch-optimise, or process individual assets.
5. Use the ⚙ Settings button to toggle PNG → WebP and TIFF → JPG conversions.

## Configuration options

| Option          | Type     | Default                                          | Description                           |
| --------------- | -------- | ------------------------------------------------ | ------------------------------------- |
| `imageAccept`   | `string` | `'image/jpeg, image/png, image/gif, image/webp'` | Accepted MIME types (comma-separated) |
| `imageMaxSize`  | `number` | `20971520` (20 MB)                               | Max file size in bytes                |
| `imageMaxWidth` | `number` | `6000`                                           | Max image width in pixels             |

## License

[MIT](LICENSE) © Tristan Bagot

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
