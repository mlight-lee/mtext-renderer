import * as THREE from 'three';

import { FontManager } from '../font';
import { StyleManager } from './styleManager';
import { TextStyle } from './types';

export class BaseText extends THREE.Object3D {
  protected _style: TextStyle;
  protected _styleManager: StyleManager;
  protected _fontManager: FontManager;
  protected _box: THREE.Box3;

  constructor(style: TextStyle, styleManager: StyleManager, fontManager: FontManager) {
    super();
    this._style = style;
    this._styleManager = styleManager;
    this._fontManager = fontManager;
    this._box = new THREE.Box3();
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
   * The bounding box without considering transformation matrix applied on this object.
   * If you want to get bounding box with transformation matrix, please call `applyMatrix4`
   * for this box.
   */
  get box() {
    return this._box;
  }
  set box(box: THREE.Box3) {
    this._box.copy(box);
  }

  protected getTextEncoding(style: TextStyle) {
    const bigFontFile = style?.bigFont;
    if (!bigFontFile) {
      return 'utf8';
    }
    if (style.bigFont.toUpperCase().startsWith('GB')) {
      return 'gbk';
    } else {
      // TODO:
      return 'utf8';
    }
  }
}
