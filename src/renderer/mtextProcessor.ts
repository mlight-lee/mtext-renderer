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
  private _currentHorizontalAlignment: MTextParagraphAlignment;
  private _currentWidthFactor: number;
  private _currentWordSpace: number;
  private _currentBlankWidth: number;
  private _currentFont: string;
  private _currentFontScaleFactor!: number;
  private _currentFontSize!: number;
  private _currentFontSizeScaleFactor: number;
  private _currentColor: number;
  private _currentMaxFontSize: number;
  private _currentUnderline: boolean = false;
  private _currentOverline: boolean = false;
  private _currentStrikeThrough: boolean = false;
  private _currentObliqueAngle: number = 0;

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
    this._currentHorizontalAlignment = options.horizontalAlignment;
    this._currentFont = this.textStyle.font.toLowerCase();
    this._currentWidthFactor = options.widthFactor;
    this._currentWordSpace = 1;
    this._currentColor = options.byLayerColor;
    this._currentFontSizeScaleFactor = 1;
    this._currentMaxFontSize = 0;
    this._currentObliqueAngle = style.obliqueAngle || 0;
    this.initLineParams();
    this._currentBlankWidth = this.calculateBlankWidth();
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
    return this._currentFont;
  }

  /**
   * The current horizontal alignment of one text line
   */
  get currentHorizontalAlignment() {
    return this._currentHorizontalAlignment;
  }

  /**
   * Scale factor of current font height. The scale factor isn't set by users in text editor.
   * It is one scale factor binded to font. For ttf or woff fonts, it is calculated by certain
   * algorithm. For shx font, it is alway equal to 1.
   */
  get currentFontScaleFactor() {
    return this._currentFontScaleFactor;
  }

  /**
   * Font size of current character
   */
  get currentFontSize() {
    return this._currentFontSize;
  }

  /**
   * Font size scale factor of current character
   */
  get currentFontSizeScaleFactor() {
    return this._currentFontSizeScaleFactor;
  }

  /**
   * The height of current line of texts
   */
  get currentLineHeight() {
    const lineSpace =
      this.defaultLineSpaceFactor * this._currentFontSize * LINE_SPACING_SCALE_FACTOR;
    return lineSpace + this.currentMaxFontSize;
  }

  /**
   * The maximum font size in current line. Characters in one line may have different font and font
   * size. So we need to store the maximum font size in current line in order to calculate the height
   * of current line.
   */
  get currentMaxFontSize() {
    return this._currentMaxFontSize;
  }

  /**
   * The current space setting between two characters
   */
  get currentWordSpace() {
    return this._currentWordSpace;
  }

  /**
   * The current scale factor of character width
   */
  get currentWidthFactor() {
    return this._currentWidthFactor;
  }

  /**
   * The current text color
   */
  get currentColor() {
    return this._currentColor;
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

  /**
   * Oblique angle of current character
   */
  get currentObliqueAngle() {
    return this._currentObliqueAngle;
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
          if (this.currentFont && this.currentFont.includes('.shx')) {
            console.log(`Doesn't support custom fonts: ${this.currentFont}`);
          }
          break;
        }
      case 'C':
        if (item.changes.aci) {
          if (item.changes.aci === 0) {
            this._currentColor = this._options.byBlockColor;
          } else if (item.changes.aci === 256) {
            this._currentColor = this._options.byLayerColor;
          } else {
            this._currentColor = getColorByIndex(item.changes.aci);
          }
        } else if (item.changes.rgb) {
          this._currentColor =
            (item.changes.rgb[0] << 16) + (item.changes.rgb[1] << 8) + item.changes.rgb[2];
        }
        break;
      case 'W':
        if (item.changes.widthFactor) {
          if (item.changes.widthFactor.isRelative) {
            this._currentWidthFactor = item.changes.widthFactor.value * this.maxWidth;
          } else {
            this._currentWidthFactor = item.changes.widthFactor.value * 0.93;
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
            // TODO: Handle relative value
            this._currentWordSpace = item.changes.charTrackingFactor.value;
          } else {
            this._currentWordSpace = item.changes.charTrackingFactor.value;
          }
        }
        break;
      case 'q':
        if (item.changes.paragraph && item.changes.paragraph.align) {
          this._currentHorizontalAlignment = item.changes.paragraph.align;
        }
        break;
      case 'L':
        this._currentUnderline = true;
        break;
      case 'l':
        this._currentUnderline = false;
        break;
      case 'O':
        this._currentOverline = true;
        break;
      case 'o':
        this._currentOverline = false;
        break;
      case 'K':
        this._currentStrikeThrough = true;
        break;
      case 'k':
        this._currentStrikeThrough = false;
        break;
      case 'Q':
        if (item.changes.oblique !== undefined) {
          this._currentObliqueAngle = item.changes.oblique;
        }
        break;
      default:
        // TODO: handle psm, underscore, overscore, and etc.
        break;
    }
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
        this.startNewLine();
        this.processGeometries(geometries, lineGeometries, group);
      } else if (token.type === TokenType.WORD) {
        const words = token.data;
        if (Array.isArray(words)) {
          words.forEach((word) => this.processWord(word, geometries, lineGeometries));
        } else if (typeof words === 'string' && words.length > 0) {
          this.processWord(words, geometries, lineGeometries);
        }
        this.processGeometries(geometries, lineGeometries, group);
      } else if (token.type === TokenType.SPACE) {
        this.processBlank();
      } else if (token.type === TokenType.PROPERTIES_CHANGED) {
        this.processFormat(token.data as ChangedProperties);
        this.processGeometries(geometries, lineGeometries, group);
      } else if (token.type === TokenType.STACK) {
        this.processStack(token.data as string[], geometries, lineGeometries);
        this.processGeometries(geometries, lineGeometries, group);
      }
    }

    if (geometries.length > 0 || lineGeometries.length > 0) {
      this.processGeometries(geometries, lineGeometries, group);
    }
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
      geometries.length = 0;
      lineGeometries.length = 0;
    }
  }

  private processWord(
    word: string,
    geometries: THREE.BufferGeometry[],
    lineGeometries: THREE.BufferGeometry[]
  ) {
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
    const currentWordSpace = this._currentWordSpace;
    const currentFontSize = this._currentFontSize;
    const currentFontSizeScaleFactor = this._currentFontSizeScaleFactor;

    // First pass: calculate widths
    this._hOffset = currentHOffset;
    this._currentWordSpace = 1;
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
      this._currentFontSizeScaleFactor = currentFontSizeScaleFactor * 0.7;
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
        this._vOffset = currentVOffset - currentFontSize * 0.3;
        for (let i = 0; i < denominator.length; i++) {
          this.processChar(denominator[i], subscriptGeometries, subscriptLineGeometries);
        }
        geometries.push(...subscriptGeometries);
        lineGeometries.push(...subscriptLineGeometries);
        this._hOffset = currentHOffset + denominatorWidth;
      }

      // Restore original font size
      this._currentFontSizeScaleFactor = currentFontSizeScaleFactor;
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
    this._currentWordSpace = currentWordSpace;
  }

  private processBlank() {
    this._hOffset += this._currentBlankWidth;
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

    const geometry = shape.toGeometry();
    geometry.scale(this.currentWidthFactor, 1, 1);

    // Apply oblique/skew transformation if needed
    if (this.currentObliqueAngle) {
      // Oblique/skew is typically along X axis by tan(angle)
      const angleRad = (this.currentObliqueAngle * Math.PI) / 180;
      const skewMatrix = new THREE.Matrix4();
      skewMatrix.set(1, Math.tan(angleRad), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      geometry.applyMatrix4(skewMatrix);
    }

    if (this.hOffset > (this.maxWidth || Infinity)) {
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
    if (this._currentUnderline) {
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
    if (this._currentOverline) {
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
    if (this._currentStrikeThrough) {
      const strikeGeom = new THREE.BufferGeometry();
      const strikeY = charY + charHeight / 2;
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

  processLastLine() {
    this.processAlignment();
  }

  private initLineParams() {
    this.calcuateLineParams();
  }

  private changeFontHeight(newFontHeight: number) {
    this.calcuateLineParams(newFontHeight);
  }

  private changeFont(fontName: string) {
    let processedFontName = fontName;
    if (this._options.removeFontExtension) {
      processedFontName = fontName.replace(/\.(ttf|otf|woff|shx)$/, '');
    }
    this._currentFont = this.fontManager.findAndReplaceFont(processedFontName);
    this._currentBlankWidth = this.calculateBlankWidth();
    this.calcuateLineParams();
  }

  private changeFontSizeScaleFactor(factor: number) {
    this._currentFontSizeScaleFactor *= factor;
    this.calcuateLineParams();
  }

  /**
   * Calcuate font size, line space, line height and other parameters.
   */
  private calcuateLineParams(newFontHeight?: number) {
    this._currentFontScaleFactor = this.fontManager.getFontScaleFactor(this.currentFont);

    const fontHeight = newFontHeight || this.defaultFontSize || this.textStyle.fixedTextHeight;
    this._currentFontSize =
      fontHeight * this.currentFontScaleFactor * this.currentFontSizeScaleFactor;
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
    if (this.currentFontSize > this.currentMaxFontSize) {
      this._currentMaxFontSize = this.currentFontSize;
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
          break;
        case MTextParagraphAlignment.CENTER:
          geometries.forEach((g) => g.translate((this.maxWidth - size.x) / 2, 0, 0));
          break;
        case MTextParagraphAlignment.RIGHT:
          geometries.forEach((g) => g.translate(this.maxWidth - size.x, 0, 0));
          break;
        case MTextParagraphAlignment.DISTRIBUTED:
          if (geometries.length > 1) {
            const gap = (this.maxWidth - size.x) / (geometries.length - 1);
            for (let k = 1; k < geometries.length; k++) {
              const geometry = geometries[k];
              geometry.translate(gap * k, 0, 0);
            }
          }
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
  private calculateBlankWidth() {
    const fontType = this.fontManager.getFontType(this.currentFont);
    return fontType === 'shx' ? this.currentFontSize * 0.5 : this.currentFontSize * 0.3;
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
    const color = this.currentColor;

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
}
