import { ColorSettings, MTextData, TextStyle } from '../renderer/types'
import { MTextBaseRenderer, MTextObject } from './baseRenderer'
import { MainThreadRenderer } from './mainThreadRenderer'
import { WebWorkerRenderer, WebWorkerRendererConfig } from './webWorkerRenderer'

export type RenderMode = 'main' | 'worker'

/**
 * Unified renderer that can work in both main thread and web worker modes
 */
export class UnifiedRenderer {
  private webWorkerRenderer: WebWorkerRenderer
  private mainThreadRenderer: MainThreadRenderer
  private renderer: MTextBaseRenderer
  private defaultMode: RenderMode
  /**
   * Constructor
   *
   * @param defaultMode - Default rendering mode. Default is 'main' which means rendering in main thread.
   * @param workerConfig - Configuration options for WebWorkerRenderer which is used
   *                     when render mode is 'worker'.
   */
  constructor(
    defaultMode: RenderMode = 'main',
    workerConfig: WebWorkerRendererConfig = {}
  ) {
    this.defaultMode = defaultMode
    this.mainThreadRenderer = new MainThreadRenderer()
    this.webWorkerRenderer = new WebWorkerRenderer(workerConfig)
    this.renderer = this.mainThreadRenderer
    if (defaultMode === 'worker') {
      this.renderer = this.webWorkerRenderer
    }
  }

  /**
   * Sets the default rendering mmode
   * @param mode The default rendering mode
   */
  setDefaultMode(mode: RenderMode): void {
    if (this.defaultMode === mode) {
      return
    }
    this.defaultMode = mode
    if (mode === 'worker') {
      this.renderer = this.webWorkerRenderer
    } else {
      this.renderer = this.mainThreadRenderer
    }
  }

  /**
   * Get the default rendering mode
   */
  getDefaultMode(): RenderMode {
    return this.defaultMode
  }

  /**
   * Render MText using the current mode asynchronously.
   * @param mode - Rendering mode used. If undefined, the default rendering mode is used.
   */
  async asyncRenderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = {
      byLayerColor: 0xffffff,
      byBlockColor: 0xffffff
    },
    mode?: RenderMode
  ): Promise<MTextObject> {
    if (mode) {
      const renderer =
        mode === 'worker' ? this.webWorkerRenderer : this.mainThreadRenderer
      return renderer.asyncRenderMText(mtextContent, textStyle, colorSettings)
    } else {
      return this.renderer.asyncRenderMText(
        mtextContent,
        textStyle,
        colorSettings
      )
    }
  }

  /**
   * Render MText using the current mode synchronously. Main thread render is always used
   * for this function because web worker renderer doesn't support rendering synchronously.
   */
  syncRenderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = {
      byLayerColor: 0xffffff,
      byBlockColor: 0xffffff
    }
  ): MTextObject {
    return this.mainThreadRenderer.syncRenderMText(
      mtextContent,
      textStyle,
      colorSettings
    )
  }

  /**
   * Load fonts using the current mode
   */
  async loadFonts(fonts: string[]): Promise<{ loaded: string[] }> {
    return this.renderer.loadFonts(fonts)
  }

  /**
   * Get available fonts using the current mode
   */
  async getAvailableFonts(): Promise<{ fonts: Array<{ name: string[] }> }> {
    return this.renderer.getAvailableFonts()
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.webWorkerRenderer) {
      this.webWorkerRenderer.terminate()
    }
    this.mainThreadRenderer.destroy()
  }
}
