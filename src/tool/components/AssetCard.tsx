import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
} from '@sanity/ui'
import {
  type ConversionSettings,
  type ImageAsset,
  type ProcessStatus,
  type Violation,
  IMAGE_MAX_WIDTH,
  IMAGE_MAX_SIZE,
} from '../../helpers'

/** Human-readable size limit for display purposes */
const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024

/** Labels shown on violation badges */
const VIOLATION_LABELS: Record<Violation, string> = {
  format: 'TIFF → WebP',
  width: `> ${IMAGE_MAX_WIDTH}px`,
  size: `> ${MAX_SIZE_MB} MB`,
}

/** Builds a human-readable label for the format violation badge. */
function formatViolationLabel(settings: ConversionSettings): string {
  const parts: string[] = []
  parts.push(settings.tiffToJpg ? 'TIFF → JPG' : 'TIFF → WebP')
  if (settings.pngToWebp) parts.push('PNG → WebP')
  return parts.join(', ')
}

/** Displays a caution badge indicating which constraint was violated. */
function ViolationBadge({
  type,
  settings,
}: {
  type: Violation
  settings: ConversionSettings
}) {
  const label =
    type === 'format' ? formatViolationLabel(settings) : VIOLATION_LABELS[type]
  return (
    <Badge tone="caution" size={1}>
      {label}
    </Badge>
  )
}

/** Resolves the visual tone for an asset card based on its processing status. */
function statusTone(status: ProcessStatus) {
  const map: Record<
    ProcessStatus,
    'positive' | 'critical' | 'primary' | 'default'
  > = {
    done: 'positive',
    error: 'critical',
    processing: 'primary',
    idle: 'default',
  }
  return map[status]
}

/** Renders a single asset row with thumbnail, info, badges and action button. */
export function AssetCard({
  asset,
  onProcess,
  settings,
}: {
  asset: ImageAsset
  onProcess: (asset: ImageAsset) => void
  settings: ConversionSettings
}) {
  const isDone = asset.status === 'done' && asset.newUrl
  const thumbUrl = isDone ? asset.newUrl! : asset.url
  const sizeReduction =
    isDone && asset.newSize != null
      ? Math.round((1 - asset.newSize / asset.size) * 100)
      : null

  return (
    <Card
      key={asset._id}
      tone={statusTone(asset.status)}
      style={{ width: 'calc(100vw - 1.25rem * 2)' }}
    >
      <Flex gap={3} align="center">
        {/* Thumbnail — 64×64 with 2× source for retina */}
        <Box style={{ width: 64, height: 64, flexShrink: 0 }}>
          <img
            src={`${thumbUrl}?w=128&h=128&fit=crop&auto=format`}
            alt=""
            loading="lazy"
            style={{
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: 4,
            }}
          />
        </Box>

        {/* File info + violation badges */}
        <Stack space={2} style={{ flex: 1, minWidth: 0 }}>
          <Box style={{ width: '100%', minWidth: 0 }}>
            <Text size={1} weight="semibold">
              {isDone
                ? asset.newFilename || asset.originalFilename || asset._id
                : asset.originalFilename || asset._id}
            </Text>
          </Box>
          {isDone ? (
            <>
              <Text size={1} muted style={{ wordBreak: 'break-word' }}>
                {(asset.size / 1024 / 1024).toFixed(1)} MB →{' '}
                {(asset.newSize! / 1024 / 1024).toFixed(1)} MB
                {sizeReduction !== null && sizeReduction > 0
                  ? ` (−${sizeReduction}%)`
                  : ''}{' '}
                — {asset.newWidth}px wide
              </Text>
              <Flex gap={2} wrap="wrap">
                {asset.newWidth != null && asset.newWidth < asset.width && (
                  <Badge tone="positive" size={1}>
                    {asset.width}px → {asset.newWidth}px
                  </Badge>
                )}
              </Flex>
            </>
          ) : (
            <>
              <Flex gap={2} wrap="wrap">
                {asset.violations.map((v) => (
                  <ViolationBadge key={v} type={v} settings={settings} />
                ))}
              </Flex>
              <Text size={1} muted style={{ wordBreak: 'break-word' }}>
                {(asset.size / 1024 / 1024).toFixed(1)} MB — {asset.width}px
                wide
              </Text>
            </>
          )}
          {asset.status === 'error' && (
            <Text
              size={1}
              style={{
                color: 'var(--card-badge-critical-dot-color)',
                wordBreak: 'break-word',
              }}
            >
              {asset.error}
            </Text>
          )}
        </Stack>

        {/* Action button — contextual per status */}
        <Box style={{ flexShrink: 0 }}>
          {asset.status === 'idle' && (
            <Button
              text="Process"
              mode="ghost"
              tone="primary"
              onClick={() => onProcess(asset)}
            />
          )}
          {asset.status === 'processing' && <Spinner />}
          {asset.status === 'done' && <Badge tone="positive">Done</Badge>}
          {asset.status === 'error' && (
            <Button
              text="Retry"
              mode="ghost"
              tone="critical"
              onClick={() => onProcess(asset)}
            />
          )}
        </Box>
      </Flex>
    </Card>
  )
}
