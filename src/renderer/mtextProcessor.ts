import {
  ChangedProperties,
  MTextParagraphAlignment,
  MTextToken,
  TokenType,
} from '@mlightcad/mtext-parser';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { FontManager } from '../font';
import { StyleManager } from './styleManager';
import { MTextFlowDirection, TextStyle } from './types';
import { getColorByIndex } from '../common';

const tempVector = /*@__PURE__*/ new THREE.Vector3();

// The property palette of mtext can display line spacing. This magic number is inferred from value
// displayed in property palette of mtext.
const LINE_SPACING_SCALE_FACTOR = 1.666666;

export interface MTextFormatOptions {
  /**
   * Font size.
   */
  fontSize: number;
  /**
   * Scale factor of character width.
   */
  widthFactor: number;
  /**
   * The line space factor.
   */
  lineSpaceFactor: number;
  /**
   * The horizontal alignment.
   */
  horizontalAlignment: MTextParagraphAlignment;
  /**
   * The maximum width of one line of text string.
   */
  maxWidth: number;
  /**
   * The direction that the text string follows from its start to its finish.
   */
  flowDirection: MTextFlowDirection;
  /**
   * The color of the current block which is used when the text color is by block.
   */
  byBlockColor: number;
  /**
   * The color of the current layer which is used when the text color is by layer.
   */
  byLayerColor: number;
  /**
   * Whether to remove font name extension.
   */
  removeFontExtension: boolean;
}

/**
 * Represents the current formatting context for text rendering.
 * This class maintains the state of various text formatting properties
 * such as font, color, size, and styling options that are applied
 * to characters during text processing.
 */
class Context {
  /**
   * The current font family name in lowercase.
   * This determines which font file is used for character rendering.
   */
  font: string = '';

  /**
   * Scale factor applied to the font height.
   * This is typically calculated based on the font type and is used
   * to normalize font sizes across different font formats.
   */
  fontScaleFactor: number = 1;

  /**
   * The current font size in drawing units.
   * This represents the height of the font and affects the overall
   * size of rendered characters.
   */
  fontSize: number = 1;

  /**
   * Additional scale factor applied to the font size.
   * This allows for dynamic font size adjustments during text processing,
   * such as for superscript/subscript rendering.
   */
  fontSizeScaleFactor: number = 1;

  /**
   * The current text color as a hexadecimal value.
   * Default is white (0xffffff) and can be changed through formatting commands.
   */
  color: number = 0xffffff;

  /**
   * Whether the current text should be underlined.
   * When true, an underline line is rendered below the text.
   */
  underline: boolean = false;

  /**
   * Whether the current text should have an overline.
   * When true, a line is rendered above the text.
   */
  overline: boolean = false;

  /**
   * Whether the current text should have a strikethrough line.
   * When true, a line is rendered through the middle of the text.
   */
  strikeThrough: boolean = false;

  /**
   * The oblique angle in degrees for text skewing.
   * This creates an italic-like effect by skewing the text at the specified angle.
   * Default is 0 (no skewing).
   */
  obliqueAngle: number = 0;

  /**
   * Whether the current text should be rendered in italic style.
   * This is primarily used for mesh fonts and affects font selection.
   */
  italic: boolean = false;

  /**
   * Whether the current text should be rendered in bold style.
   * This is primarily used for mesh fonts and affects font selection.
   */
  bold: boolean = false;

  /**
   * Scale factor for character width.
   * This allows horizontal stretching or compression of characters.
   * Default is 1 (normal width).
   */
  widthFactor: number = 1;

  /**
   * The space between two characters (tracking). The meaning of this value is as follows:
   * - 1: no extra spacing (default tracking)
   * - 1.2: increases spacing by 20% of the text height
   * - 0.8: decreases spacing by 20% of the text height
   */
  wordSpace: number = 1;

  /**
   * The width of a space character for the current font and size.
   * This is calculated based on the font type and current font size.
   */
  blankWidth: number = 0;

  /**
   * Creates a new Context instance with optional initial values.
   * @param init - Partial object containing initial values for context properties
   */
  constructor(init?: Partial<Context>) {
    Object.assign(this, init);
  }

  /**
   * Creates a deep copy of the current context.
   * This is useful for saving state before applying formatting changes.
   * @returns A new Context instance with identical property values
   */
  clone(): Context {
    return new Context({ ...this });
  }
}

/**
 * This class represents lines of texts.
 */
export class MTextProcessor {
  private _style: TextStyle;
  private _styleManager: StyleManager;
  private _fontManager: FontManager;
  private _options: MTextFormatOptions;
  private _totalHeight: number;
  private _hOffset: number;
  private _vOffset: number;
  private _lineCount: number;
  private _currentLineObjects: THREE.Object3D[];
  private _contextStack: Context[] = [];
  private _currentContext: Context;
  private _maxFontSize: number = 0;
  /**
   * The current horizontal alignment for the paragraph.
   *
   * In AutoCAD MText, paragraph-level formatting commands (such as \pqr, \pql, \pqc)
   * persist for the entire paragraph and are not scoped to inline formatting groups ({} blocks).
   * Only character-level formatting (font, bold, italic, color, etc.) is scoped to {} and managed via Context.
   * Therefore, paragraph alignment is maintained at the MTextProcessor level and not in Context,
   * so it persists until explicitly changed by another paragraph alignment command.
   */
  private _currentHorizontalAlignment: MTextParagraphAlignment;
  // Paragraph properties
  private _currentIndent: number = 0;
  private _currentLeftMargin: number = 0;
  private _currentRightMargin: number = 0;

  /**
   * Construct one instance of this class and initialize some properties with default values.
   * @param style Input text style
   * @param styleManager Input text style manager instance
   * @param fontManager Input font manager instance
   * @param options Input formating options
   */
  constructor(
    style: TextStyle,
    styleManager: StyleManager,
    fontManager: FontManager,
    options: MTextFormatOptions
  ) {
    this._style = style;
    this._styleManager = styleManager;
    this._fontManager = fontManager;
    this._options = options;
    this._totalHeight = 0;
    this._hOffset = 0;
    this._vOffset = 0;
    this._lineCount = 1;
    this._currentLineObjects = [];
    this._currentContext = new Context({
      font: this.textStyle.font.toLowerCase(),
      fontScaleFactor: this.fontManager.getFontScaleFactor(this.textStyle.font.toLowerCase()),
      fontSize: options.fontSize,
      fontSizeScaleFactor: 1,
      color: options.byLayerColor,
      underline: false,
      overline: false,
      strikeThrough: false,
      obliqueAngle: style.obliqueAngle || 0,
      italic: false,
      bold: false,
      widthFactor: options.widthFactor,
      wordSpace: 1,
      blankWidth: this.calculateBlankWidthForFont(
        this.textStyle.font.toLowerCase(),
        options.fontSize
      ),
    });
    this._maxFontSize = 0;
    this._currentHorizontalAlignment = options.horizontalAlignment;
    // Initialize paragraph properties (as factors, so initial value is 0)
    this._currentIndent = 0;
    this._currentLeftMargin = 0;
    this._currentRightMargin = 0;
    this.initLineParams();
  }

  get fontManager() {
    return this._fontManager;
  }

  get styleManager() {
    return this._styleManager;
  }

  get textStyle() {
    return this._style;
  }

  /**
   * Total height of all lines of text
   */
  get totalHeight() {
    // 'totalHeight' should not include line space after the last line
    if (this._lineCount == 1) {
      return this.currentMaxFontSize;
    } else {
      return this._totalHeight + this.currentLineHeight;
    }
  }

  /**
   * The maximum width of one text line
   */
  get maxWidth() {
    return this._options.maxWidth;
  }

  /**
   * The direction that the text string follows from its start to its finish.
   */
  get flowDirection() {
    return this._options.flowDirection;
  }

  /**
   * The default horizontal alignment of one text line
   */
  get defaultHorizontalAlignment() {
    return this._options.horizontalAlignment;
  }

  /**
   * The default scale factor of character width
   */
  get defaultWidthFactor() {
    return this._options.widthFactor;
  }

  /**
   * The default font size of texts
   */
  get defaultFontSize() {
    return this._options.fontSize;
  }

  /**
   * The default line space factor
   */
  get defaultLineSpaceFactor() {
    return this._options.lineSpaceFactor;
  }

  /**
   * Font name of current character
   */
  get currentFont() {
    return this._currentContext.font;
  }

  /**
   * The current horizontal alignment of one text line
   */
  get currentHorizontalAlignment() {
    return this._currentHorizontalAlignment;
  }

  /**
   * Font size of current character
   */
  get currentFontSize() {
    return this._currentContext.fontSize;
  }

  /**
   * The height of current line of texts
   */
  get currentLineHeight() {
    const lineSpace =
      this.defaultLineSpaceFactor * this.currentFontSize * LINE_SPACING_SCALE_FACTOR;
    return lineSpace + this.currentMaxFontSize;
  }

  /**
   * The maximum font size in current line. Characters in one line may have different font and font
   * size. So we need to store the maximum font size in current line in order to calculate the height
   * of current line.
   */
  get currentMaxFontSize() {
    return this._maxFontSize;
  }

  /**
   * The current space setting between two characters. The meaning of this value is as follows.
   * - 1: no extra spacing (default tracking)
   * - 1.2: increases spacing by 20% of the text height
   * - 0.8: decreases spacing by 20% of the text height
   */
  get currentWordSpace() {
    return this._currentContext.wordSpace;
  }

  /**
   * The current scale factor of character width
   */
  get currentWidthFactor() {
    return this._currentContext.widthFactor;
  }

  /**
   * All of THREE.js objects in current line. It contains objects in all of sections of this line.
   */
  get currentLineObjects() {
    return this._currentLineObjects;
  }

  /**
   * The horizental offset of current character in this line
   */
  get hOffset() {
    return this._hOffset;
  }
  set hOffset(value: number) {
    this._hOffset = value;
  }

  /**
   * The vertical offset of current character in this line
   */
  get vOffset() {
    return this._vOffset;
  }
  set vOffset(value: number) {
    this._vOffset = value;
  }

  get currentIndent() {
    return this._currentIndent;
  }

  get currentLeftMargin() {
    return this._currentLeftMargin;
  }

  get currentRightMargin() {
    return this._currentRightMargin;
  }

  get maxLineWidth() {
    // The actual usable width for text in a line, considering margins
    return this.maxWidth - this._currentLeftMargin - this._currentRightMargin;
  }

  /**
   * Process text format information
   * @param item Input mtext inline codes
   */
  processFormat(item: ChangedProperties) {
    switch (item.command) {
      case 'f':
      case 'F':
        if (item.changes.fontFace) {
          this.changeFont(item.changes.fontFace.family);
          // Handle style and weight for mesh fonts only
          const fontType = this.fontManager.getFontType(this._currentContext.font);
          if (fontType === 'mesh') {
            this._currentContext.italic = item.changes.fontFace.style === 'Italic';
            this._currentContext.bold = (item.changes.fontFace.weight || 400) >= 700;
            this._currentContext.obliqueAngle = this.textStyle.obliqueAngle || 0;
          } else {
            this._currentContext.italic = false;
            this._currentContext.bold = false;
            if (item.changes.fontFace.style === 'Italic') {
              this._currentContext.obliqueAngle = 15;
            } else {
              this._currentContext.obliqueAngle = this.textStyle.obliqueAngle || 0;
            }
          }
          break;
        }
      case 'c':
      case 'C':
        if (item.changes.aci) {
          if (item.changes.aci === 0) {
            this._currentContext.color = this._options.byBlockColor;
          } else if (item.changes.aci === 256) {
            this._currentContext.color = this._options.byLayerColor;
          } else {
            this._currentContext.color = getColorByIndex(item.changes.aci);
          }
        } else if (item.changes.rgb) {
          this._currentContext.color =
            (item.changes.rgb[0] << 16) + (item.changes.rgb[1] << 8) + item.changes.rgb[2];
        }
        break;
      case 'W':
        if (item.changes.widthFactor) {
          if (item.changes.widthFactor.isRelative) {
            this._currentContext.widthFactor = item.changes.widthFactor.value * this.maxWidth;
          } else {
            this._currentContext.widthFactor = item.changes.widthFactor.value * 0.93;
          }
        }
        break;
      case 'H':
        if (item.changes.capHeight) {
          if (item.changes.capHeight.isRelative) {
            this.changeFontSizeScaleFactor(item.changes.capHeight.value);
          } else {
            this.changeFontHeight(item.changes.capHeight.value);
          }
        }
        break;
      case 'T':
        if (item.changes.charTrackingFactor) {
          if (item.changes.charTrackingFactor.isRelative) {
            this._currentContext.wordSpace = item.changes.charTrackingFactor.value + 1;
          } else {
            this._currentContext.wordSpace = item.changes.charTrackingFactor.value;
          }
        }
        break;
      case 'p':
        if (item.changes.paragraph) {
          if (item.changes.paragraph.align) {
            this._currentHorizontalAlignment = item.changes.paragraph.align;
          }
          if (typeof item.changes.paragraph.indent === 'number') {
            this._currentIndent = item.changes.paragraph.indent * this.defaultFontSize;
            this._hOffset += this._currentIndent;
          }
          if (typeof item.changes.paragraph.left === 'number') {
            this._currentLeftMargin = item.changes.paragraph.left * this.defaultFontSize;
          }
          if (typeof item.changes.paragraph.right === 'number') {
            this._currentRightMargin = item.changes.paragraph.right * this.defaultFontSize;
          }
        }
        break;
      case 'L':
        this._currentContext.underline = true;
        break;
      case 'l':
        this._currentContext.underline = false;
        break;
      case 'O':
        this._currentContext.overline = true;
        break;
      case 'o':
        this._currentContext.overline = false;
        break;
      case 'K':
        this._currentContext.strikeThrough = true;
        break;
      case 'k':
        this._currentContext.strikeThrough = false;
        break;
      case 'Q':
        if (item.changes.oblique !== undefined) {
          this._currentContext.obliqueAngle = item.changes.oblique;
        }
        break;
      default:
        // TODO: handle psm, underscore, overscore, and etc.
        break;
    }
  }

  /**
   * Reset paragraph properties to their default values from options.
   */
  private resetParagraphProperties() {
    this._currentIndent = 0;
    this._currentLeftMargin = 0;
    this._currentRightMargin = 0;
    this._currentHorizontalAlignment = this._options.horizontalAlignment;
  }

  /**
   * Start a new paragraph by processing current geometries, resetting paragraph properties,
   * and starting a new line with indent applied.
   * @param geometries Current text geometries to process
   * @param lineGeometries Current line geometries to process
   * @param group The group to add processed geometries to
   */
  private startNewParagraph(
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[],
    group: THREE.Group
  ) {
    this.processGeometries(geometries, lineGeometries, group);
    this.startNewLine(); // Mark as first line of paragraph, apply indent
    // Reset paragraph properties to defaults at the start of a new paragraph
    this.resetParagraphProperties();
  }

  /**
   * Render the specified texts
   * @param item Input texts to render
   */
  processText(tokens: Generator<MTextToken>) {
    const geometries: THREE.BufferGeometry[] = [];
    const lineGeometries: THREE.BufferGeometry[] = [];
    const group: THREE.Group = new THREE.Group();

    for (const token of tokens) {
      if (token.type === TokenType.NEW_PARAGRAPH) {
        this.startNewParagraph(geometries, lineGeometries, group);
      } else if (token.type === TokenType.WORD) {
        const words = token.data;
        if (Array.isArray(words)) {
          words.forEach((word) => this.processWord(word, geometries, lineGeometries));
        } else if (typeof words === 'string' && words.length > 0) {
          this.processWord(words, geometries, lineGeometries);
        }
      } else if (token.type === TokenType.SPACE) {
        this.processBlank();
      } else if (token.type === TokenType.PROPERTIES_CHANGED) {
        // FLUSH before changing style: ensures all geometries up to this point use the previous style.
        // This is critical for correct color/formatting application within a line.
        this.processGeometries(geometries, lineGeometries, group);
        const item = token.data as ChangedProperties;
        if (item.command === undefined) {
          // Restore previous context when exiting a formatting group
          if (this._contextStack.length > 0) {
            this._currentContext = this._contextStack.pop()!;
          }
        } else {
          // Only push context to stack if this is the first formatting command in a group
          // We can detect this by checking if the context stack is empty or if we haven't pushed yet
          if (item.depth > 0) {
            this._contextStack.push(this._currentContext.clone());
          }
          this.processFormat(item);
        }
      } else if (token.type === TokenType.STACK) {
        this.processStack(token.data as string[], geometries, lineGeometries);
        this.processGeometries(geometries, lineGeometries, group);
      }
    }

    if (geometries.length > 0 || lineGeometries.length > 0) {
      this.processGeometries(geometries, lineGeometries, group);
    }
    this.processLastLine();
    return group;
  }

  private processGeometries(
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[],
    group: THREE.Group
  ) {
    if (geometries.length > 0 || lineGeometries.length > 0) {
      const object = this.toThreeObject(geometries, lineGeometries);
      group.add(object);
      this._currentLineObjects.push(object);
      geometries.length = 0;
      lineGeometries.length = 0;
    }
  }

  private processWord(
    word: string,
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[]
  ) {
    // --- Word-level wrapping logic ---
    // 1. Measure word width
    let wordWidth = 0;
    for (let i = 0; i < word.length; i++) {
      const shape = this.getCharShape(word[i]);
      if (shape) {
        if (this.currentHorizontalAlignment == MTextParagraphAlignment.DISTRIBUTED) {
          wordWidth += shape.width * this.currentWidthFactor;
        } else {
          wordWidth += shape.width * this.currentWordSpace * this.currentWidthFactor;
        }
      } else {
        wordWidth += this._currentContext.blankWidth;
      }
    }
    // 2. If word would overflow, start a new line first (no indent for wrapped lines)
    if (this.hOffset + wordWidth > (this.maxLineWidth || Infinity)) {
      this.startNewLine(); // Do not apply indent for wrapped lines
    }
    // 3. Render the word character by character
    for (let i = 0; i < word.length; i++) {
      this.processChar(word[i], geometries, lineGeometries);
    }
  }

  private processStack(
    stackData: string[],
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[]
  ) {
    const [numerator, denominator, divider] = stackData;

    // Store current position and state
    const currentHOffset = this._hOffset;
    const currentVOffset = this._vOffset;
    const currentWordSpace = this._currentContext.wordSpace;
    const currentFontSize = this._currentContext.fontSize;
    const currentFontSizeScaleFactor = this._currentContext.fontSizeScaleFactor;

    // First pass: calculate widths
    this._hOffset = currentHOffset;
    this._currentContext.wordSpace = 1;
    let numeratorWidth = 0;
    for (let i = 0; i < numerator.length; i++) {
      const shape = this.getCharShape(numerator[i]);
      if (shape) {
        numeratorWidth += shape.width * this.currentWidthFactor;
      }
    }

    this._hOffset = currentHOffset;
    let denominatorWidth = 0;
    for (let i = 0; i < denominator.length; i++) {
      const shape = this.getCharShape(denominator[i]);
      if (shape) {
        denominatorWidth += shape.width * this.currentWidthFactor;
      }
    }

    const fractionWidth = Math.max(numeratorWidth, denominatorWidth);
    const numeratorOffset = (fractionWidth - numeratorWidth) / 2;
    const denominatorOffset = (fractionWidth - denominatorWidth) / 2;

    // Handle different stack types based on divider
    if (divider === '^') {
      // Scale down font size to 70% for subscript and superscript
      this._currentContext.fontSizeScaleFactor = currentFontSizeScaleFactor * 0.7;
      this.calcuateLineParams();

      // Superscript case
      if (numerator && !denominator) {
        const superscriptGeometries: THREE.BufferGeometry[] = [];
        const superscriptLineGeometries: THREE.BufferGeometry[] = [];
        this._hOffset = currentHOffset;
        this._vOffset = currentVOffset + currentFontSize * 0.1;
        for (let i = 0; i < numerator.length; i++) {
          this.processChar(numerator[i], superscriptGeometries, superscriptLineGeometries);
        }
        geometries.push(...superscriptGeometries);
        lineGeometries.push(...superscriptLineGeometries);
        this._hOffset = currentHOffset + numeratorWidth;
      }
      // Subscript case
      else if (!numerator && denominator) {
        const subscriptGeometries: THREE.BufferGeometry[] = [];
        const subscriptLineGeometries: THREE.BufferGeometry[] = [];
        this._hOffset = currentHOffset;
        this._vOffset = currentVOffset - currentFontSize * 0.6;
        for (let i = 0; i < denominator.length; i++) {
          this.processChar(denominator[i], subscriptGeometries, subscriptLineGeometries);
        }
        geometries.push(...subscriptGeometries);
        lineGeometries.push(...subscriptLineGeometries);
        this._hOffset = currentHOffset + denominatorWidth;
      }

      // Restore original font size
      this._currentContext.fontSizeScaleFactor = currentFontSizeScaleFactor;
      this.calcuateLineParams();
    } else {
      // Fraction case
      // Second pass: render numerator
      const numeratorGeometries: THREE.BufferGeometry[] = [];
      const numeratorLineGeometries: THREE.BufferGeometry[] = [];
      this._hOffset = currentHOffset + numeratorOffset;
      this._vOffset = currentVOffset + this.currentFontSize * 0.3;
      for (let i = 0; i < numerator.length; i++) {
        this.processChar(numerator[i], numeratorGeometries, numeratorLineGeometries);
      }
      geometries.push(...numeratorGeometries);
      lineGeometries.push(...numeratorLineGeometries);

      // Render denominator
      const denominatorGeometries: THREE.BufferGeometry[] = [];
      const denominatorLineGeometries: THREE.BufferGeometry[] = [];
      this._hOffset = currentHOffset + denominatorOffset;
      this._vOffset = currentVOffset - this.currentFontSize * 0.6;
      for (let i = 0; i < denominator.length; i++) {
        this.processChar(denominator[i], denominatorGeometries, denominatorLineGeometries);
      }
      geometries.push(...denominatorGeometries);
      lineGeometries.push(...denominatorLineGeometries);

      // Render fraction line if needed
      if (divider === '/' || divider === '#') {
        const lineGeometry = new THREE.BufferGeometry();
        const lineVertices = new Float32Array([
          currentHOffset,
          currentVOffset - this.currentFontSize * 0.8,
          0,
          currentHOffset + fractionWidth,
          currentVOffset - this.currentFontSize * 0.8,
          0,
        ]);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
        lineGeometry.setIndex(null);
        lineGeometries.push(lineGeometry);
      }

      this._hOffset = currentHOffset + fractionWidth;
    }

    // Restore state
    this._vOffset = currentVOffset;
    this._currentContext.wordSpace = currentWordSpace;
  }

  private processBlank() {
    this._hOffset += this._currentContext.blankWidth;
  }

  private processChar(
    char: string,
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[]
  ): void {
    const shape = this.getCharShape(char);
    if (!shape) {
      this.processBlank();
      return;
    }

    let geometry = shape.toGeometry();
    geometry.scale(this.currentWidthFactor, 1, 1);

    // Apply oblique/skew transformation if needed (oblique or italic)
    let obliqueAngle = this._currentContext.obliqueAngle;
    if (this._currentContext.italic) {
      obliqueAngle += 15; // Simulate italic with a 15 degree skew
    }
    if (obliqueAngle) {
      const angleRad = (obliqueAngle * Math.PI) / 180;
      const skewMatrix = new THREE.Matrix4();
      skewMatrix.set(1, Math.tan(angleRad), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      geometry.applyMatrix4(skewMatrix);
    }

    // Simulate bold for mesh fonts by stroking the geometry
    const fontType = this.fontManager.getFontType(this.currentFont);
    if (this._currentContext.bold && fontType === 'mesh') {
      // Expand geometry slightly to simulate bold
      // This is a simple approach: scale up slightly from the center
      const boldScale = 1.06; // 6% wider
      geometry.scale(boldScale, boldScale, 1);
    }

    if (this.hOffset > (this.maxLineWidth || Infinity)) {
      this.startNewLine();
    }

    let charX = this.hOffset;
    let charY =
      this.flowDirection == MTextFlowDirection.BOTTOM_TO_TOP
        ? this.vOffset
        : this.vOffset - this.currentFontSize;
    let charWidth = shape.width * this.currentWidthFactor;
    let charHeight = this.currentFontSize;

    geometry.translate(charX, charY, 0);

    if (this.currentHorizontalAlignment == MTextParagraphAlignment.DISTRIBUTED) {
      this._hOffset += shape.width * this.currentWidthFactor;
    } else {
      this._hOffset += shape.width * this.currentWordSpace * this.currentWidthFactor;
    }
    geometries.push(geometry);

    // Underline, overline, strikeThrough
    const lineOffset = charHeight * 0.05;
    const lineZ = 0.001;
    if (this._currentContext.underline) {
      const underlineGeom = new THREE.BufferGeometry();
      const underlineY = charY - lineOffset;
      underlineGeom.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([charX, underlineY, lineZ, charX + charWidth, underlineY, lineZ]),
          3
        )
      );
      underlineGeom.setIndex(null);
      lineGeometries.push(underlineGeom);
    }
    if (this._currentContext.overline) {
      const overlineGeom = new THREE.BufferGeometry();
      const overlineY = charY + charHeight + lineOffset;
      overlineGeom.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([charX, overlineY, lineZ, charX + charWidth, overlineY, lineZ]),
          3
        )
      );
      overlineGeom.setIndex(null);
      lineGeometries.push(overlineGeom);
    }
    if (this._currentContext.strikeThrough) {
      const strikeGeom = new THREE.BufferGeometry();
      const strikeY = charY + charHeight / 2 - charHeight * 0.2;
      strikeGeom.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([charX, strikeY, lineZ, charX + charWidth, strikeY, lineZ]),
          3
        )
      );
      strikeGeom.setIndex(null);
      lineGeometries.push(strikeGeom);
    }
  }

  private processLastLine() {
    this.processAlignment();
  }

  private initLineParams() {
    this.calcuateLineParams();
  }

  private changeFont(fontName: string) {
    let processedFontName = fontName;
    if (this._options.removeFontExtension) {
      processedFontName = fontName.replace(/\.(ttf|otf|woff|shx)$/, '');
    }
    this._currentContext.font = this.fontManager.findAndReplaceFont(processedFontName);
    this._currentContext.blankWidth = this.calculateBlankWidthForFont(
      this._currentContext.font,
      this._currentContext.fontSize
    );
    this.calcuateLineParams();
  }

  /**
   * Calcuate font size, line space, line height and other parameters.
   */
  private calcuateLineParams(newFontHeight?: number) {
    this._currentContext.fontScaleFactor = this.fontManager.getFontScaleFactor(this.currentFont);

    const fontHeight = newFontHeight || this.defaultFontSize || this.textStyle.fixedTextHeight;
    this._currentContext.fontSize =
      fontHeight * this._currentContext.fontScaleFactor * this._currentContext.fontSizeScaleFactor;
  }

  /**
   * Get text shape of the specified character
   * @param char Input one character
   * @returns Return the text shape of the specified character
   */
  private getCharShape(char: string) {
    let shape = this.fontManager.getCharShape(char, this.currentFont, this.currentFontSize);
    if (this.textStyle.bigFont && !shape) {
      shape = this.fontManager.getCharShape(char, this.textStyle.bigFont, this.currentFontSize);
    }
    if (!shape) {
      // When the text cannot be found in the font file, all font files are searched until the text is found.
      shape = this.fontManager.getCharShape(char, '', this.currentFontSize);
    }
    if (!shape) {
      shape = this.fontManager.getNotFoundTextShape(this.currentFontSize);
    }

    // Store the maximum font size in current line
    if (this.currentFontSize > this._maxFontSize) {
      this._maxFontSize = this.currentFontSize;
    }
    return shape;
  }

  private startNewLine() {
    this._hOffset = 0;
    if (this.flowDirection == MTextFlowDirection.BOTTOM_TO_TOP) {
      this._vOffset += this.currentLineHeight;
    } else {
      this._vOffset -= this.currentLineHeight;
    }
    this._lineCount++;
    this.processAlignment();
    this._currentLineObjects = [];
    if (this._lineCount == 2) {
      this._totalHeight = this.currentMaxFontSize;
    } else {
      this._totalHeight = this._totalHeight + this.currentLineHeight;
    }
    // Reset maxFontSize for the new line
    this._maxFontSize = 0;
  }

  /**
   * Apply translation on the specified buffer geometries according to text alignment setting
   */
  private processAlignment() {
    const geometries: THREE.BufferGeometry[] = [];
    this.currentLineObjects.forEach((object) =>
      object.traverse((obj) => {
        if ('geometry' in obj) {
          geometries.push(obj.geometry as THREE.BufferGeometry);
        }
      })
    );
    if (geometries.length == 0) return;

    let bbox: THREE.Box3 | undefined;
    geometries.forEach((g, i) => {
      if (!g.boundingBox) {
        g.computeBoundingBox();
      }
      if (i === 0) {
        bbox = g.boundingBox as THREE.Box3;
      } else {
        bbox!.union(g.boundingBox as THREE.Box3);
      }
    });
    if (bbox) {
      const size = bbox.getSize(tempVector);
      switch (this.currentHorizontalAlignment) {
        case MTextParagraphAlignment.LEFT:
          // Shift to left margin
          geometries.forEach((g) => g.translate(this._currentLeftMargin - bbox!.min.x, 0, 0));
          break;
        case MTextParagraphAlignment.CENTER:
          geometries.forEach((g) =>
            g.translate(
              this._currentLeftMargin + (this.maxLineWidth - size.x) / 2 - bbox!.min.x,
              0,
              0
            )
          );
          break;
        case MTextParagraphAlignment.RIGHT:
          geometries.forEach((g) =>
            g.translate(this._currentLeftMargin + this.maxLineWidth - size.x - bbox!.min.x, 0, 0)
          );
          break;
        case MTextParagraphAlignment.DISTRIBUTED:
          if (geometries.length > 1) {
            const gap = (this.maxLineWidth - size.x) / (geometries.length - 1);
            for (let k = 1; k < geometries.length; k++) {
              const geometry = geometries[k];
              geometry.translate(gap * k, 0, 0);
            }
          }
          // Shift to left margin
          geometries.forEach((g) => g.translate(this._currentLeftMargin - bbox!.min.x, 0, 0));
          break;
        default:
          break;
      }
    }
  }

  /**
   * In AutoCAD, the width of a regular space character (ASCII 32, the space key on the keyboard) in MText
   * depends on the current font and text height, and is not a fixed value.
   * Specifically:
   * - Space width ≈ Text height × space width ratio defined by the font
   * - For common TrueType fonts (like Arial), the space width is typically about 1/4 to 1/3 of the text height.
   * For example, if the text height is 10 (units), the space width would be approximately 2.5 to 3.3 units.
   * - For SHX fonts (AutoCAD's built-in vector fonts, such as txt.shx), the space width is often half the text height.
   * So if the text height is 10, the space width is typically 5 units.
   */
  private calculateBlankWidthForFont(font: string, fontSize: number) {
    const fontType = this.fontManager.getFontType(font);
    return fontType === 'shx' ? fontSize * 0.5 : fontSize * 0.3;
  }

  /**
   * Convert the text shape geometries to three.js object
   * @param geometries Input text shape geometries
   * @returns Return three.js object created from the specified text shape geometries
   */
  private toThreeObject(
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[]
  ) {
    const meshGroup = new THREE.Group();
    const color = this._currentContext.color;

    // Mesh font (ExtrudeGeometry)
    const meshGeoms = geometries.filter((g) => g instanceof THREE.ExtrudeGeometry);
    if (meshGeoms.length > 0) {
      const mesh = new THREE.Mesh();
      mesh.geometry = mergeGeometries(meshGeoms);
      mesh.material = this.styleManager.getMeshBasicMaterial(color);
      mesh.userData.bboxIntersectionCheck = true;
      meshGroup.add(mesh);
    }

    // All line-based geometries: SHX font + underline/overline/strikeThrough
    const allLineGeoms = [
      ...lineGeometries,
      ...geometries.filter((g) => !(g instanceof THREE.ExtrudeGeometry)),
    ];
    if (allLineGeoms.length > 0) {
      const lineMesh = new THREE.LineSegments();
      lineMesh.geometry = mergeGeometries(allLineGeoms);
      lineMesh.material = this.styleManager.getLineBasicMaterial(color);
      lineMesh.userData.bboxIntersectionCheck = true;
      meshGroup.add(lineMesh);
    }

    // Reduce hierarchy if only one child
    if (meshGroup.children.length === 1) {
      return meshGroup.children[0];
    } else {
      return meshGroup;
    }
  }

  private changeFontSizeScaleFactor(value: number) {
    this._currentContext.fontSizeScaleFactor *= value;
    this.calcuateLineParams();
  }

  private changeFontHeight(value: number) {
    this._currentContext.fontSize =
      value * this._currentContext.fontScaleFactor * this._currentContext.fontSizeScaleFactor;
    this.calcuateLineParams();
  }
}
