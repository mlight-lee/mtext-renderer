import { parse } from 'opentype.js';

import { MeshFontData } from './meshFont';

/**
 * Parses a mesh font from raw binary data.
 * This function converts raw font data (e.g., TTF, OTF, WOFF) into a MeshFontData object
 * that can be used by the MeshFont class.
 *
 * @param data - The raw font data as an ArrayBuffer
 * @returns A MeshFontData object containing the parsed font information
 */
export function parseMeshFont(data: ArrayBuffer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convert = (font: any, reversed: boolean): MeshFontData => {
    const round = Math.round;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glyphs = {} as any;
    const glyphIndexMap = font.encoding.cmap.glyphIndexMap;
    const unicodes = Object.keys(glyphIndexMap);

    // Use character 'A' to calculate scale factor
    const scaleFactorCharGlyph = font.glyphs.glyphs[glyphIndexMap[65]];
    let scaleFactor = 1;
    if (scaleFactorCharGlyph) {
      scaleFactor = font.unitsPerEm / scaleFactorCharGlyph.yMax;
    }

    for (let i = 0; i < unicodes.length; i++) {
      const unicode = unicodes[i];
      const glyph = font.glyphs.glyphs[glyphIndexMap[unicode]];
      if (unicode !== undefined) {
        const token = {
          ha: round(glyph.advanceWidth),
          x_min: round(glyph.xMin),
          x_max: round(glyph.xMax),
          o: '',
        };
        if (reversed) {
          glyph.path.commands = reverseCommands(glyph.path.commands);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        glyph.path.commands.forEach(function (command: any) {
          if (command.type.toLowerCase() === 'c') {
            command.type = 'b';
          }
          token.o += command.type.toLowerCase() + ' ';
          if (command.x !== undefined && command.y !== undefined) {
            token.o += round(command.x) + ' ' + round(command.y) + ' ';
          }
          if (command.x1 !== undefined && command.y1 !== undefined) {
            token.o += round(command.x1) + ' ' + round(command.y1) + ' ';
          }
          if (command.x2 !== undefined && command.y2 !== undefined) {
            token.o += round(command.x2) + ' ' + round(command.y2) + ' ';
          }
        });
        glyphs[String.fromCodePoint(glyph.unicode)] = token;
      }
    }
    return {
      glyphs: glyphs,
      familyName: font.getEnglishName('fullName'),
      ascender: round(font.ascender),
      descender: round(font.descender),
      underlinePosition: font.tables.post.underlinePosition,
      underlineThickness: font.tables.post.underlineThickness,
      boundingBox: {
        xMin: font.tables.head.xMin,
        xMax: font.tables.head.xMax,
        yMin: font.tables.head.yMin,
        yMax: font.tables.head.yMax,
      },
      resolution: font.unitsPerEm || 1000,
      scaleFactor: scaleFactor,
      original_font_information: font.tables.name,
    };
  };

  /**
   * Reverses the order of path commands in a font glyph.
   * This is used when the font needs to be rendered in reverse order.
   *
   * @param commands - Array of path commands to reverse
   * @returns Array of reversed path commands
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reverseCommands = (commands: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paths: any[] = [];
    let path;
    commands.forEach(function (c) {
      if (c.type.toLowerCase() === 'm') {
        path = [c];
        paths.push(path);
      } else if (c.type.toLowerCase() !== 'z') {
        path.push(c);
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reversed: any[] = [];
    paths.forEach(function (p) {
      const result = {
        type: 'm',
        x: p[p.length - 1].x,
        y: p[p.length - 1].y,
      };
      reversed.push(result);
      for (let i = p.length - 1; i > 0; i--) {
        const command = p[i];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = { type: command.type };
        if (command.x2 !== undefined && command.y2 !== undefined) {
          result.x1 = command.x2;
          result.y1 = command.y2;
          result.x2 = command.x1;
          result.y2 = command.y1;
        } else if (command.x1 !== undefined && command.y1 !== undefined) {
          result.x1 = command.x1;
          result.y1 = command.y1;
        }
        result.x = p[i - 1].x;
        result.y = p[i - 1].y;
        reversed.push(result);
      }
    });
    return reversed;
  };

  return convert(parse(data), false);
}
