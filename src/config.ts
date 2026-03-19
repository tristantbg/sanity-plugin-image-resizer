import { type CustomValidator } from 'sanity'

/** @public */
export interface ImageResizerOptions {
    /** Accepted image MIME types (comma-separated). Default: 'image/jpeg, image/png, image/gif, image/webp' */
    imageAccept?: string
    /** Max file size in bytes. Default: 20 * 1024 * 1024 (20 MB) */
    imageMaxSize?: number
    /** Max image width in pixels. Default: 10000 */
    imageMaxWidth?: number
}

const DEFAULTS: Required<ImageResizerOptions> = {
    imageAccept: 'image/jpeg, image/png, image/gif, image/webp',
    imageMaxSize: 20 * 1024 * 1024,
    imageMaxWidth: 6000,
}

/** @public */
export let IMAGE_ACCEPT = DEFAULTS.imageAccept
/** @public */
export let IMAGE_MAX_SIZE = DEFAULTS.imageMaxSize
/** @public */
export let IMAGE_MAX_WIDTH = DEFAULTS.imageMaxWidth

export function applyConfig(options?: ImageResizerOptions) {
    const resolved = { ...DEFAULTS, ...options }
    IMAGE_ACCEPT = resolved.imageAccept
    IMAGE_MAX_SIZE = resolved.imageMaxSize
    IMAGE_MAX_WIDTH = resolved.imageMaxWidth
}

/** @public */
export const validateImageSize: CustomValidator = async (value: any, context) => {
    if (!value?.asset?._ref) return true

    const client = context.getClient({ apiVersion: '2025-02-19' })
    const asset = await client.fetch(
        `*[_id == $id][0]{ size, "width": metadata.dimensions.width, mimeType }`,
        { id: value.asset._ref }
    )

    if (!asset) return true

    const allowedMimeTypes = IMAGE_ACCEPT.split(',').map((s) => s.trim())
    if (asset.mimeType && !allowedMimeTypes.includes(asset.mimeType)) {
        return `File type "${asset.mimeType}" is not allowed. Accepted types: ${allowedMimeTypes.join(', ')}`
    }

    if (asset.size && asset.size > IMAGE_MAX_SIZE) {
        const sizeMB = (asset.size / (1024 * 1024)).toFixed(1)
        const maxMB = (IMAGE_MAX_SIZE / (1024 * 1024)).toFixed(0)
        return `Image size (${sizeMB}MB) exceeds the maximum of ${maxMB}MB`
    }

    if (asset.width && asset.width > IMAGE_MAX_WIDTH) {
        return `Image width (${asset.width}px) exceeds the maximum of ${IMAGE_MAX_WIDTH}px`
    }

    return true
}
