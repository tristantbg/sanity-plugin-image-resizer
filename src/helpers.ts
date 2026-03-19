import { type CustomValidator } from 'sanity'

// ─── types ──────────────────────────────────────────────────────────────────

/** @public */
export interface ImageResizerOptions {
    /** Accepted image MIME types (comma-separated). Default: 'image/jpeg, image/png, image/gif, image/webp' */
    imageAccept?: string
    /** Max file size in bytes. Default: 20 * 1024 * 1024 (20 MB) */
    imageMaxSize?: number
    /** Max image width in pixels. Default: 10000 */
    imageMaxWidth?: number
}

export type Violation = 'format' | 'width' | 'size'
export type ProcessStatus = 'idle' | 'processing' | 'done' | 'error'

/** User-configurable format conversion toggles */
export interface ConversionSettings {
    /** Convert PNG images to WebP */
    pngToWebp: boolean
    /** Convert TIFF images to JPG (instead of WebP) */
    tiffToJpg: boolean
}

export const DEFAULT_SETTINGS: ConversionSettings = {
    pngToWebp: false,
    tiffToJpg: false,
}

export interface ImageAsset {
    _id: string
    url: string
    originalFilename: string
    mimeType: string
    size: number
    width: number
    violations: Violation[]
    status: ProcessStatus
    error?: string
    /** Post-processing result info */
    newUrl?: string
    newSize?: number
    newWidth?: number
    newFilename?: string
}

// ─── plugin config state ────────────────────────────────────────────────────

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

// ─── constants ──────────────────────────────────────────────────────────────

/** Sanity Image API format parameter for each output MIME type */
export const MIME_FORMAT_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
}

/** Quality steps to try when the image exceeds the size budget (high → low) */
export const QUALITY_STEPS = [92, 80, 70, 60, 50, 40]

/** Number of assets to process in parallel during batch runs */
export const CONCURRENCY = 3

// ─── helpers ────────────────────────────────────────────────────────────────

/** Checks which resize constraints the asset violates. */
export function getViolations(
    asset: Pick<ImageAsset, 'mimeType' | 'size' | 'width'>,
    settings: ConversionSettings
): Violation[] {
    const v: Violation[] = []
    if (asset.mimeType === 'image/tiff') v.push('format')
    if (settings.pngToWebp && asset.mimeType === 'image/png') v.push('format')
    if (asset.width > IMAGE_MAX_WIDTH) v.push('width')
    if (asset.size > IMAGE_MAX_SIZE) v.push('size')
    return v
}

/**
 * Determines the Sanity Image API `fm` parameter for the output,
 * taking user conversion settings into account.
 */
export function outputFormat(
    inputMimeType: string,
    settings: ConversionSettings
): string {
    if (inputMimeType === 'image/tiff') return settings.tiffToJpg ? 'jpg' : 'webp'
    if (inputMimeType === 'image/png' && settings.pngToWebp) return 'webp'
    return MIME_FORMAT_MAP[inputMimeType] ?? 'png'
}

/**
 * Uses the Sanity Image API to resize/re-encode an image server-side.
 * Appends URL parameters (`w`, `fm`, `q`) and progressively lowers
 * quality until the downloaded blob fits within `IMAGE_MAX_SIZE`.
 */
export async function processImage(
    url: string,
    inputMimeType: string,
    currentWidth: number,
    settings: ConversionSettings
): Promise<{ blob: Blob; outFormat: string }> {
    const outFormat = outputFormat(inputMimeType, settings)

    const transformUrl = new URL(url)
    transformUrl.searchParams.set('fm', outFormat)
    transformUrl.searchParams.set(
        'w',
        String(Math.min(currentWidth, IMAGE_MAX_WIDTH))
    )

    const maxSizeMB = IMAGE_MAX_SIZE / 1024 / 1024

    for (const q of QUALITY_STEPS) {
        transformUrl.searchParams.set('q', String(q))

        const res = await fetch(transformUrl.toString())
        if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status})`)

        const blob = await res.blob()
        if (blob.size <= IMAGE_MAX_SIZE) {
            return { blob, outFormat }
        }
    }

    throw new Error(`Cannot compress image below ${maxSizeMB} MB`)
}

/**
 * Recursively traverses a document tree and collects all paths where
 * `asset._ref === oldId`. Returns a flat `{ path: newRef }` object
 * compatible with `client.patch().set()`.
 */
export function buildReplacementPatch(
    obj: unknown,
    oldId: string,
    newId: string,
    path = ''
): Record<string, { _type: 'reference'; _ref: string }> {
    if (!obj || typeof obj !== 'object') return {}

    if (Array.isArray(obj)) {
        return obj.reduce<Record<string, { _type: 'reference'; _ref: string }>>(
            (acc, item, i) => {
                const key =
                    item && typeof item === 'object' && typeof item._key === 'string'
                        ? `_key=="${item._key}"`
                        : String(i)
                const childPath = path ? `${path}[${key}]` : `[${key}]`
                return Object.assign(
                    acc,
                    buildReplacementPatch(item, oldId, newId, childPath)
                )
            },
            {}
        )
    }

    const record = obj as Record<string, unknown>

    if ((record.asset as any)?._ref === oldId) {
        const assetPath = path ? `${path}.asset` : 'asset'
        return { [assetPath]: { _type: 'reference', _ref: newId } }
    }

    return Object.keys(record)
        .filter((k) => !k.startsWith('_'))
        .reduce<Record<string, { _type: 'reference'; _ref: string }>>(
            (acc, key) => {
                const childPath = path ? `${path}.${key}` : key
                return Object.assign(
                    acc,
                    buildReplacementPatch(record[key], oldId, newId, childPath)
                )
            },
            {}
        )
}

// ─── validation ─────────────────────────────────────────────────────────────

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
