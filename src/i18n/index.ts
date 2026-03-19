import { defineLocaleResourceBundle } from 'sanity'

export const imageResizerLocaleNamespace = 'image-resizer'

export const imageResizerUsEnglishLocaleBundle = defineLocaleResourceBundle({
    locale: 'en-US',
    namespace: imageResizerLocaleNamespace,
    resources: () => import('./resources'),
})
