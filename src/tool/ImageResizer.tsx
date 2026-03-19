import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from 'sanity'
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Heading,
  Label,
  Spinner,
  Stack,
  Switch,
  Text,
} from '@sanity/ui'
import { CogIcon } from '@sanity/icons'
import {
  type ConversionSettings,
  type ImageAsset,
  CONCURRENCY,
  DEFAULT_SETTINGS,
  IMAGE_MAX_SIZE,
  IMAGE_MAX_WIDTH,
  buildReplacementPatch,
  getViolations,
  processImage,
} from '../helpers'
import { AssetCard } from './components/AssetCard'

/** Human-readable size limit for display purposes */
const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024

const KV_SETTINGS_KEY = 'image-resizer-settings'

function loadSettings(): ConversionSettings {
  try {
    const raw = localStorage.getItem(KV_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        pngToWebp:
          typeof parsed.pngToWebp === 'boolean'
            ? parsed.pngToWebp
            : DEFAULT_SETTINGS.pngToWebp,
        tiffToJpg:
          typeof parsed.tiffToJpg === 'boolean'
            ? parsed.tiffToJpg
            : DEFAULT_SETTINGS.tiffToJpg,
      }
    }
  } catch {
    // ignore corrupt data
  }
  return DEFAULT_SETTINGS
}

/**
 * Studio tool that scans all image assets for constraint violations
 * (TIFF format, oversized width/filesize) and lets editors batch-resize
 * them in-place — re-encoding, resizing and re-linking references.
 */
export function ImageResizerView() {
  const client = useClient({ apiVersion: '2025-02-19' })
  const [assets, setAssets] = useState<ImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [processingAll, setProcessingAll] = useState(false)
  const [settings, setSettings] = useState<ConversionSettings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)

  /** Wraps setSettings to also persist to localStorage. */
  const updateSettings = useCallback(
    (updater: (prev: ConversionSettings) => ConversionSettings) => {
      setSettings((prev) => {
        const next = updater(prev)
        localStorage.setItem(KV_SETTINGS_KEY, JSON.stringify(next))
        return next
      })
    },
    []
  )

  // Ref keeps processAll's sequential loop in sync with latest state
  const assetsRef = useRef(assets)
  useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  // ── data fetching ───────────────────────────────────────────────────────

  /** Fetches all image assets that violate at least one constraint. */
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await client.fetch<
        Omit<ImageAsset, 'violations' | 'status'>[]
      >(
        `*[_type == "sanity.imageAsset" && (
            mimeType == "image/tiff" ||
            metadata.dimensions.width > ${IMAGE_MAX_WIDTH} ||
            size > ${IMAGE_MAX_SIZE}
          )] | order(size desc) [0...500] {
            _id, url, originalFilename, mimeType, size,
            "width": metadata.dimensions.width
          }`
      )
      setAssets(
        raw.map((a) => ({
          ...a,
          violations: getViolations(a, settings),
          status: 'idle',
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [client, settings])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // ── single-asset processing ─────────────────────────────────────────────

  /** Helper to update a single asset's state by ID. */
  const updateAsset = useCallback(
    (id: string, patch: Partial<ImageAsset>) =>
      setAssets((prev) =>
        prev.map((a) => (a._id === id ? { ...a, ...patch } : a))
      ),
    []
  )

  /**
   * Processes one asset end-to-end:
   * 1. Re-encode / resize via Sanity Image API transformations
   * 2. Upload the transformed image as a new asset
   * 3. Find & patch all documents that reference the old asset
   * 4. Delete the old asset
   */
  const processAsset = useCallback(
    async (asset: ImageAsset) => {
      updateAsset(asset._id, { status: 'processing', error: undefined })

      try {
        // 1 — Resize / convert via Sanity Image API
        const { blob, outFormat } = await processImage(
          asset.url,
          asset.mimeType,
          asset.width,
          settings
        )

        // Skip replacement if the new file is bigger than the original
        if (blob.size >= asset.size) {
          updateAsset(asset._id, {
            status: 'error',
            error: `Skipped: resized file (${(blob.size / 1024 / 1024).toFixed(1)} MB) is not smaller than original (${(asset.size / 1024 / 1024).toFixed(1)} MB)`,
          })
          return
        }

        // 2 — Upload replacement asset
        const baseName =
          asset.originalFilename?.replace(/\.[^.]+$/, '') || 'image'
        const newAsset = await client.assets.upload('image', blob, {
          filename: `${baseName}.${outFormat}`,
          contentType: `image/${outFormat}`,
        })

        // 3 — Re-link all referencing documents
        const refs = await client.fetch<{ _id: string }[]>(
          `*[references($id)]{ _id }`,
          { id: asset._id }
        )

        for (const { _id } of refs) {
          const doc = await client.getDocument(_id)
          if (!doc) continue
          const patch = buildReplacementPatch(doc, asset._id, newAsset._id)
          if (Object.keys(patch).length > 0) {
            await client.patch(_id).set(patch).commit()
          }
        }

        // 4 — Delete the old asset now that all references point to the new one
        await client.delete(asset._id)

        // Fetch the new asset's metadata for display
        const newMeta = await client.fetch<{
          url: string
          size: number
          width: number
          originalFilename: string
        }>(
          `*[_id == $id][0]{ url, size, originalFilename, "width": metadata.dimensions.width }`,
          { id: newAsset._id }
        )

        updateAsset(asset._id, {
          status: 'done',
          newUrl: newMeta?.url ?? newAsset.url,
          newSize: newMeta?.size ?? blob.size,
          newWidth: newMeta?.width ?? Math.min(asset.width, IMAGE_MAX_WIDTH),
          newFilename: newMeta?.originalFilename ?? `${baseName}.${outFormat}`,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        updateAsset(asset._id, { status: 'error', error: message })
      }
    },
    [client, updateAsset, settings]
  )

  // ── batch processing ────────────────────────────────────────────────────

  /**
   * Processes all pending / failed assets with up to `CONCURRENCY`
   * tasks running in parallel using a simple worker-pool pattern.
   */
  const processAll = useCallback(async () => {
    setProcessingAll(true)
    const pending = assetsRef.current.filter(
      (a) => a.status === 'idle' || a.status === 'error'
    )

    let idx = 0
    const next = async (): Promise<void> => {
      while (idx < pending.length) {
        const asset = pending[idx++]
        await processAsset(asset)
      }
    }

    // Spawn `CONCURRENCY` workers that all pull from the same queue
    await Promise.all(Array.from({ length: CONCURRENCY }, () => next()))

    setProcessingAll(false)
  }, [processAsset])

  // ── derived state (memoised) ────────────────────────────────────────────

  /** Aggregated status counts used for badges and conditional rendering. */
  const counts = useMemo(
    () => ({
      pending: assets.filter((a) => a.status === 'idle').length,
      processing: assets.filter((a) => a.status === 'processing').length,
      done: assets.filter((a) => a.status === 'done').length,
      error: assets.filter((a) => a.status === 'error').length,
    }),
    [assets]
  )

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <Container
      width={4}
      padding={4}
      style={{ width: 'calc(100vw - 1.25rem * 2)' }}
    >
      <Stack space={5}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Flex align="flex-start" justify="space-between" gap={4} wrap="wrap">
          <Stack space={2} style={{ flex: 1, minWidth: 0 }}>
            <Heading size={2}>Image Resizer</Heading>
            <Card
              size={1}
              tone="transparent"
              style={{ wordBreak: 'break-word' }}
            >
              Converts TIFF images to WebP. Resizes/compresses all images to fit
              within {IMAGE_MAX_WIDTH}px / {MAX_SIZE_MB} MB.
            </Card>
          </Stack>
          <Flex gap={2} align="center" wrap="wrap" style={{ flexShrink: 0 }}>
            <Button
              icon={CogIcon}
              mode="ghost"
              onClick={() => setShowSettings(true)}
              disabled={processingAll}
            />
            <Button
              text="Refresh"
              mode="ghost"
              onClick={fetchAssets}
              disabled={loading || processingAll}
            />
            {counts.pending > 0 && (
              <Button
                text={
                  processingAll
                    ? 'Processing…'
                    : `Process All (${counts.pending})`
                }
                tone="primary"
                onClick={processAll}
                disabled={processingAll || loading}
                icon={processingAll ? Spinner : undefined}
              />
            )}
          </Flex>
        </Flex>

        {/* ── Status badges ──────────────────────────────────────────── */}
        {!loading && assets.length > 0 && (
          <Flex gap={3} wrap="wrap">
            {counts.pending > 0 && (
              <Badge tone="caution">{counts.pending} pending</Badge>
            )}
            {counts.processing > 0 && (
              <Badge tone="primary">{counts.processing} processing</Badge>
            )}
            {counts.done > 0 && (
              <Badge tone="positive">{counts.done} done</Badge>
            )}
            {counts.error > 0 && (
              <Badge tone="critical">{counts.error} failed</Badge>
            )}
          </Flex>
        )}

        {/* ── Asset list ─────────────────────────────────────────────── */}
        {loading ? (
          <Flex padding={6} justify="center" align="center" gap={3}>
            <Spinner />
            <Text muted>Scanning assets…</Text>
          </Flex>
        ) : assets.length === 0 ? (
          <Card padding={5} radius={2} tone="positive" border>
            <Text align="center">All images meet the requirements.</Text>
          </Card>
        ) : (
          <Stack space={2}>
            {assets.map((asset) => (
              <AssetCard
                key={asset._id}
                asset={asset}
                onProcess={processAsset}
                settings={settings}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {/* ── Settings dialog ────────────────────────────────────────── */}
      {showSettings && (
        <Dialog
          id="image-resizer-settings"
          header="Conversion Settings"
          onClose={() => setShowSettings(false)}
          width={1}
        >
          <Box padding={4}>
            <Stack space={4}>
              <Flex align="center" gap={3}>
                <Switch
                  id="png-to-webp"
                  checked={settings.pngToWebp}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked
                    updateSettings((s) => ({ ...s, pngToWebp: checked }))
                  }}
                />
                <Label htmlFor="png-to-webp" style={{ cursor: 'pointer' }}>
                  Convert PNG → WebP
                </Label>
              </Flex>
              <Flex align="center" gap={3}>
                <Switch
                  id="tiff-to-jpg"
                  checked={settings.tiffToJpg}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked
                    updateSettings((s) => ({ ...s, tiffToJpg: checked }))
                  }}
                />
                <Label htmlFor="tiff-to-jpg" style={{ cursor: 'pointer' }}>
                  Convert TIFF → JPG (instead of WebP)
                </Label>
              </Flex>
              <Text size={1} muted>
                Changes apply on next Refresh.
              </Text>
            </Stack>
          </Box>
        </Dialog>
      )}
    </Container>
  )
}
