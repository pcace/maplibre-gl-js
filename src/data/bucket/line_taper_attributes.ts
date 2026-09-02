import {createLayout, type StructArrayLayout, type StructArrayMember} from '../../util/struct_array.ts';

/*
 * Per-vertex line taper attribute.

 * `a_taper` stores the normalized position of a vertex along its line
 * (0.0 = line start, 1.0 = line end). The line vertex shader uses it to
 * interpolate the line width between `line-width-start` and `line-width-end`:

 *     width = mix(widthStart, widthEnd, a_taper)

 * The attribute lives in its own vertex buffer which is only created and bound
 * when a line style layer uses one of the taper properties, so regular lines
 * pay zero extra memory or upload cost.
 */
export const lineTaperAttributes: StructArrayLayout = createLayout([
    {name: 'a_taper', components: 1, type: 'Float32'}
], 4);

export const members: StructArrayMember[] = lineTaperAttributes.members;
export const size: number = lineTaperAttributes.size;
export const alignment: number = lineTaperAttributes.alignment;