export default {
    // ── Tool ────────────────────────────────────────────────────────────────
    /** Tool title shown in the Studio sidebar */
    'tool.title': 'Image Resizer',

    // ── Header ──────────────────────────────────────────────────────────────
    /** Main heading on the tool page */
    'header.title': 'Image Resizer',
    /** Description below the heading ({{maxWidth}} = pixel limit, {{maxSize}} = MB limit) */
    'header.description':
        'Converts TIFF images to WebP. Resizes/compresses all images to fit within {{maxWidth}}px / {{maxSize}} MB.',

    // ── Actions ─────────────────────────────────────────────────────────────
    /** Refresh button label */
    'action.refresh': 'Refresh',
    /** Process-all button label ({{count}} = number of pending assets) */
    'action.process-all': 'Process All ({{count}})',
    /** Label for the button that lets the current in-flight tasks finish */
    'action.finish-ongoing': 'Finish ongoing tasks ({{count}})',
    /** Label for the stop button that cancels the queue immediately */
    'action.stop-all': 'Stop All (possible data loss)',

    // ── Status badges ───────────────────────────────────────────────────────
    /** Pending badge ({{count}} = number) */
    'status.pending': '{{count}} pending',
    /** Processing badge */
    'status.processing': '{{count}} processing',
    /** Done badge */
    'status.done': '{{count}} done',
    /** Failed badge */
    'status.failed': '{{count}} failed',

    // ── Empty / loading states ──────────────────────────────────────────────
    /** Shown while scanning assets */
    'state.scanning': 'Scanning assets…',
    /** Shown when no violating assets are found */
    'state.all-good': 'All images meet the requirements.',

    // ── Settings dialog ─────────────────────────────────────────────────────
    /** Settings dialog header */
    'settings.title': 'Conversion Settings',
    /** PNG → WebP toggle label */
    'settings.png-to-webp': 'Convert PNG → WebP',
    /** TIFF → JPG toggle label */
    'settings.tiff-to-jpg': 'Convert TIFF → JPG (instead of WebP)',
    /** Hint below toggles */
    'settings.apply-hint': 'Changes apply on next Refresh.',

    // ── Asset card ──────────────────────────────────────────────────────────
    /** Violation badge: TIFF → WebP */
    'violation.tiff-to-webp': 'TIFF → WebP',
    /** Violation badge: TIFF → JPG */
    'violation.tiff-to-jpg': 'TIFF → JPG',
    /** Violation badge: PNG → WebP */
    'violation.png-to-webp': 'PNG → WebP',
    /** Violation badge: exceeds max width ({{maxWidth}} = pixel limit) */
    'violation.width': '> {{maxWidth}}px',
    /** Violation badge: exceeds max size ({{maxSize}} = MB limit) */
    'violation.size': '> {{maxSize}} MB',
    /** Asset size summary ({{size}} MB — {{width}}px wide) */
    'asset.summary': '{{size}} MB — {{width}}px wide',
    /** Asset done summary ({{oldSize}} MB → {{newSize}} MB — {{width}}px wide) */
    'asset.summary-done': '{{oldSize}} MB → {{newSize}} MB{{reduction}} — {{width}}px wide',
    /** Reduction percentage shown after size (e.g. " (−32%)") */
    'asset.reduction': ' (−{{percent}}%)',
    /** Width reduction badge ({{oldWidth}}px → {{newWidth}}px) */
    'asset.width-reduced': '{{oldWidth}}px → {{newWidth}}px',
    /** Process button */
    'asset.process': 'Process',
    /** Done badge */
    'asset.done': 'Done',
    /** Retry button */
    'asset.retry': 'Retry',
}
