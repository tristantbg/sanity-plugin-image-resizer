import { definePlugin } from 'sanity'
import { imageResizerUsEnglishLocaleBundle } from './i18n'
import { applyConfig, type ImageResizerOptions } from './helpers'
import { ImageResizerView } from './tool/ImageResizer'

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import { defineConfig } from 'sanity'
 * import { imageResizerPlugin } from 'sanity-plugin-image-resizer'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [
 *     imageResizerPlugin({
 *       imageAccept: 'image/jpeg, image/png, image/gif, image/webp',
 *       imageMaxSize: 20 * 1024 * 1024,
 *       imageMaxWidth: 6000,
 *     }),
 *   ],
 * })
 * ```
 */

/**
 * @public
 */
export const imageResizerPlugin = definePlugin<ImageResizerOptions | void>(
  (options) => {
    applyConfig(options ?? undefined)

    return {
      name: 'sanity-plugin-image-resizer',

      tools: (prev) => {
        return [
          ...prev,
          {
            name: 'image-resizer',
            title: 'Image Optimiser',
            component: ImageResizerView,
          },
        ]
      },

      i18n: {
        bundles: [imageResizerUsEnglishLocaleBundle],
      },
    }
  }
)
