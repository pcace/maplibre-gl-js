import {Uniform1i, Uniform1f, Uniform2f, Uniform3f} from '../uniform_binding.ts';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units.ts';
import {extend, translatePosition} from '../../util/util.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {IReadonlyTransform} from '../../geo/transform_interface.ts';
import type {Tile} from '../../tile/tile.ts';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import type {Painter} from '../../render/painter.ts';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.ts';

export type LineUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
} & Partial<LineTaperUniformsType>;

/** Extra uniforms used when tapered lines (`line-width-start`/`line-width-end`) are active. */
export type LineTaperUniformsType = {
    'u_width_start': Uniform1f;
    'u_width_end': Uniform1f;
};

export type LineUniformValuesType = UniformValues<LineUniformsType> & Partial<UniformValues<LineTaperUniformsType>>;

export type LineGradientUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_image': Uniform1i;
    'u_image_height': Uniform1f;
} & Partial<LineTaperUniformsType>;

export type LinePatternUniformsType = {
    'u_translation': Uniform2f;
    'u_texsize': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_image': Uniform1i;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
} & Partial<LineTaperUniformsType>;

export type LineSDFUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_tileratio': Uniform1f;
    'u_crossfade_from': Uniform1f;
    'u_crossfade_to': Uniform1f;
    'u_image': Uniform1i;
    'u_mix': Uniform1f;
    'u_lineatlas_width': Uniform1f;
    'u_lineatlas_height': Uniform1f;
} & Partial<LineTaperUniformsType>;

export type LineGradientSDFUniformsType = {
    'u_translation': Uniform2f;
    'u_ratio': Uniform1f;
    'u_device_pixel_ratio': Uniform1f;
    'u_units_to_pixels': Uniform2f;
    'u_image': Uniform1i;
    'u_image_height': Uniform1f;
    'u_tileratio': Uniform1f;
    'u_crossfade_from': Uniform1f;
    'u_crossfade_to': Uniform1f;
    'u_image_dash': Uniform1i;
    'u_mix': Uniform1f;
    'u_lineatlas_width': Uniform1f;
    'u_lineatlas_height': Uniform1f;
};

const lineUniforms = (context: Context, locations: UniformLocations): LineUniformsType => ({
    'u_translation': new Uniform2f(context, locations.u_translation),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    ...taperUniforms(context, locations)
});

/**
 * Binds the taper width uniforms when the shader was compiled with `#define TAPER`
 * (i.e. the locations are present). Returns an empty object for regular lines, so the
 * uniforms are simply not part of `fixedUniforms` and never touched.
 */
function taperUniforms(context: Context, locations: UniformLocations): Partial<LineTaperUniformsType> {
    if (locations.u_width_start && locations.u_width_end) {
        return {
            'u_width_start': new Uniform1f(context, locations.u_width_start),
            'u_width_end': new Uniform1f(context, locations.u_width_end)
        };
    }
    return {};
}

const lineGradientUniforms = (context: Context, locations: UniformLocations): LineGradientUniformsType => ({
    'u_translation': new Uniform2f(context, locations.u_translation),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_image_height': new Uniform1f(context, locations.u_image_height),
    ...taperUniforms(context, locations)
});

const linePatternUniforms = (context: Context, locations: UniformLocations): LinePatternUniformsType => ({
    'u_translation': new Uniform2f(context, locations.u_translation),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade),
    ...taperUniforms(context, locations)
});

const lineSDFUniforms = (context: Context, locations: UniformLocations): LineSDFUniformsType => ({
    'u_translation': new Uniform2f(context, locations.u_translation),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_mix': new Uniform1f(context, locations.u_mix),
    'u_tileratio': new Uniform1f(context, locations.u_tileratio),
    'u_crossfade_from': new Uniform1f(context, locations.u_crossfade_from),
    'u_crossfade_to': new Uniform1f(context, locations.u_crossfade_to),
    'u_lineatlas_width': new Uniform1f(context, locations.u_lineatlas_width),
    'u_lineatlas_height': new Uniform1f(context, locations.u_lineatlas_height),
    ...taperUniforms(context, locations)
});

const lineGradientSDFUniforms = (context: Context, locations: UniformLocations): LineGradientSDFUniformsType => ({
    'u_translation': new Uniform2f(context, locations.u_translation),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_image_height': new Uniform1f(context, locations.u_image_height),
    'u_tileratio': new Uniform1f(context, locations.u_tileratio),
    'u_crossfade_from': new Uniform1f(context, locations.u_crossfade_from),
    'u_crossfade_to': new Uniform1f(context, locations.u_crossfade_to),
    'u_image_dash': new Uniform1i(context, locations.u_image_dash),
    'u_mix': new Uniform1f(context, locations.u_mix),
    'u_lineatlas_width': new Uniform1f(context, locations.u_lineatlas_width),
    'u_lineatlas_height': new Uniform1f(context, locations.u_lineatlas_height),
    ...taperUniforms(context, locations)
});

const lineUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    ratioScale: number,
    taper?: [number, number],
): LineUniformValuesType => {
    const transform = painter.transform;

    return {
        'u_translation': calculateTranslation(painter, tile, layer),
        'u_ratio': ratioScale / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_device_pixel_ratio': painter.pixelRatio,
        'u_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ],
        ...(taper && {'u_width_start': taper[0], 'u_width_end': taper[1]})
    };
};

const lineGradientUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    ratioScale: number,
    imageHeight: number,
    taper?: [number, number],
): UniformValues<LineGradientUniformsType> & Partial<UniformValues<LineTaperUniformsType>> => {
    return extend(lineUniformValues(painter, tile, layer, ratioScale, taper), {
        'u_image': 0,
        'u_image_height': imageHeight,
    });
};

const linePatternUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    ratioScale: number,
    crossfade: CrossfadeParameters,
    taper?: [number, number],
): UniformValues<LinePatternUniformsType> & Partial<UniformValues<LineTaperUniformsType>> => {
    const transform = painter.transform;
    const tileZoomRatio = calculateTileRatio(tile, transform);
    return {
        'u_translation': calculateTranslation(painter, tile, layer),
        'u_texsize': tile.imageAtlasTexture.size,
        // camera zoom ratio
        'u_ratio': ratioScale / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_device_pixel_ratio': painter.pixelRatio,
        'u_image': 0,
        'u_scale': [tileZoomRatio, crossfade.fromScale, crossfade.toScale],
        'u_fade': crossfade.t,
        'u_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ],
        ...(taper && {'u_width_start': taper[0], 'u_width_end': taper[1]})
    };
};

const lineSDFUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    ratioScale: number,
    crossfade: CrossfadeParameters,
    taper?: [number, number],
): UniformValues<LineSDFUniformsType> & Partial<UniformValues<LineTaperUniformsType>> => {
    const transform = painter.transform;
    const tileRatio = calculateTileRatio(tile, transform);

    return extend(lineUniformValues(painter, tile, layer, ratioScale, taper), {
        'u_tileratio': tileRatio,
        'u_crossfade_from': crossfade.fromScale,
        'u_crossfade_to': crossfade.toScale,
        'u_image': 0,
        'u_mix': crossfade.t,
        'u_lineatlas_width': painter.lineAtlas.width,
        'u_lineatlas_height': painter.lineAtlas.height,
    });
};

const lineGradientSDFUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    ratioScale: number,
    crossfade: CrossfadeParameters,
    imageHeight: number,
    taper?: [number, number],
): UniformValues<LineGradientSDFUniformsType> & Partial<UniformValues<LineTaperUniformsType>> => {
    const transform = painter.transform;
    const tileRatio = calculateTileRatio(tile, transform);

    return extend(lineUniformValues(painter, tile, layer, ratioScale, taper), {
        'u_image': 0,
        'u_image_height': imageHeight,
        'u_tileratio': tileRatio,
        'u_crossfade_from': crossfade.fromScale,
        'u_crossfade_to': crossfade.toScale,
        'u_image_dash': 1,
        'u_mix': crossfade.t,
        'u_lineatlas_width': painter.lineAtlas.width,
        'u_lineatlas_height': painter.lineAtlas.height,
    });
};

function calculateTileRatio(tile: Tile, transform: IReadonlyTransform) {
    return 1 / pixelsToTileUnits(tile, 1, transform.tileZoom);
}

function calculateTranslation(painter: Painter, tile: Tile, layer: LineStyleLayer): [number, number] {
    // Translate line points prior to any transformation
    return translatePosition(
        painter.transform,
        tile,
        layer.paint.get('line-translate'),
        layer.paint.get('line-translate-anchor')
    );
}

export {
    lineUniforms,
    lineGradientUniforms,
    linePatternUniforms,
    lineSDFUniforms,
    lineGradientSDFUniforms,
    lineUniformValues,
    lineGradientUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues,
    lineGradientSDFUniformValues
};
