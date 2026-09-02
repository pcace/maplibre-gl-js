// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define scale 0.015873016

layout(location = 0) in ivec2 a_pos_normal;
layout(location = 1) in uvec4 a_data;
#ifdef TAPER
// Per-vertex line position (0 = start, 1 = end), bound from the line bucket's
// taper buffer (see `line_taper_attributes.ts`). No explicit layout location is
// assigned: it is linked after the data-driven paint attributes.
in float a_taper;
#endif

uniform vec2 u_translation;
uniform mediump float u_ratio;
uniform vec2 u_units_to_pixels;
uniform lowp float u_device_pixel_ratio;
#ifdef TAPER
// Tapered lines: the width varies along the line between `line-width-start`
// and `line-width-end`. The two are uniform (per feature, as with `line-width`)
// while `a_taper` (0 = start, 1 = end) varies per vertex.
uniform lowp float u_width_start;
uniform lowp float u_width_end;
#endif

out vec2 v_normal;
#ifdef TAPER
out vec2 v_width2;
#else
flat out vec2 v_width2;
#endif
out float v_gamma_scale;
out highp float v_linesofar;
#ifdef GLOBE
out float v_depth;
#endif

#pragma maplibre: define highp vec4 color
#pragma maplibre: define lowp float blur
#pragma maplibre: define lowp float opacity
#pragma maplibre: define mediump float gapwidth
#pragma maplibre: define lowp float offset
#pragma maplibre: define mediump float width

void main() {
    #pragma maplibre: initialize highp vec4 color
    #pragma maplibre: initialize lowp float blur
    #pragma maplibre: initialize lowp float opacity
    #pragma maplibre: initialize mediump float gapwidth
    #pragma maplibre: initialize lowp float offset
    #pragma maplibre: initialize mediump float width

    // Move vertex outside clip space to discard triangle when opacity is negligible
    if (opacity < 0.01) {
        gl_Position = vec4(-2.0, -2.0, -2.0, 1.0);
        return;
    }

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;

    vec2 a_extrude = vec2(ivec2(a_data.xy) - 128);
    float a_direction = float(int(a_data.z & 3u) - 1);

    v_linesofar = float((a_data.z >> 2u) + a_data.w * 64u) * 2.0;

    vec2 pos = vec2(a_pos_normal >> 1);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    mediump vec2 normal = vec2(a_pos_normal & 1);
    normal.y = normal.y * 2.0 - 1.0;
    v_normal = normal;

#ifdef TAPER
    // Interpolate the line width along the line. `a_taper` runs from 0 at the
    // start to 1 at the end of each line; a value below/above that range (from
    // the duplicate vertices of caps and joins) is clamped by `mix`.
    width = mix(u_width_start, u_width_end, a_taper);
#endif

    // these transformations used to be applied in the JS and native code bases.
    // moved them into the shader for clarity and simplicity.
    gapwidth = gapwidth / 2.0;
    float halfwidth = width / 2.0;
    offset = -1.0 * offset;

    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);
    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + (halfwidth == 0.0 ? 0.0 : ANTIALIASING);

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    mediump vec2 dist = outset * a_extrude * scale;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    mediump float u = 0.5 * a_direction;
    mediump float t = 1.0 - abs(u);
    mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);

    float adjustedThickness = projectLineThickness(pos.y);
    vec4 projected_no_extrude = projectTile(pos + offset2 / u_ratio * adjustedThickness + u_translation);
    vec4 projected_with_extrude = projectTile(pos + offset2 / u_ratio * adjustedThickness + u_translation + dist / u_ratio * adjustedThickness);
    gl_Position = projected_with_extrude;
    #ifdef GLOBE
    v_depth = gl_Position.z / gl_Position.w;
    #endif

    // calculate how much the perspective view squishes or stretches the extrude
    #ifdef TERRAIN3D
        v_gamma_scale = 1.0; // not needed, because this is done automatically via the mesh
    #else
        float extrude_length_without_perspective = length(dist);
        float extrude_length_with_perspective = length((projected_with_extrude.xy - projected_no_extrude.xy) / projected_with_extrude.w * u_units_to_pixels);
        v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;
    #endif

    v_width2 = vec2(outset, inset);
}
