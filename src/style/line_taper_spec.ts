import {latest} from '@maplibre/maplibre-gl-style-spec';
import type {StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

/*
 * Single source of truth for the extra line paint properties implemented by
 * MapLibre GL JS itself, which are not part of the published maplibre-style-spec
 * package (yet).
 *
 * `line-width-start` and `line-width-end` implement tapered lines: the line width
 * is interpolated between the two values along the length of each line. The default
 * of `-1` means "not set" — the line vertex shader then falls back to `line-width`,
 * and the line bucket skips the per-vertex taper buffer entirely.
 */
export const lineTaperPaintSpecs: {[name: string]: StylePropertySpecification} = {
    'line-width-start': {
        type: 'number',
        default: -1,
        transition: true,
        'property-type': 'data-constant',
        expression: {interpolated: true, parameters: ['zoom']}
    },
    'line-width-end': {
        type: 'number',
        default: -1,
        transition: true,
        'property-type': 'data-constant',
        expression: {interpolated: true, parameters: ['zoom']}
    }
};

/**
 * Makes the style validators accept the extra properties by patching the
 * style-spec `latest` entry the validators read from. Idempotent, and a no-op
 * once the properties land in the published spec.
 */
export function extendStyleSpecWithLineTaper(): void {
    const paintLine = latest.paint_line as Record<string, unknown>;
    for (const name of Object.keys(lineTaperPaintSpecs)) {
        if (!(name in paintLine)) {
            paintLine[name] = lineTaperPaintSpecs[name];
        }
    }
}