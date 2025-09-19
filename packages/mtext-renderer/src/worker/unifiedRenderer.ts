import { ColorSettings, MTextData, TextStyle } from '../renderer/types'
import { MTextBaseRenderer, MTextObject } from './baseRenderer'
import { MainThreadRenderer } from './mainThreadRenderer'
import { WebWorkerRenderer, WebWorkerRendererConfig } from './webWorkerRenderer'

export type RenderMode = 'main' | 'worker'

/**
 * Unified renderer that can work in both main thread and web worker modes
 */
export class UnifiedRenderer {
  private workerManager: WebWorkerRenderer | null = null
  private mainThreadRenderer: MainThreadRenderer
  private adapter: MTextBaseRenderer
  private currentMode: RenderMode
  private workerConfig?: WebWorkerRendererConfig

  /**
   * Constructor
   *
   * @param mode - Rendering mode. Default is 'main' which means rendering in main thread.
   * @param workerConfig - Configuration options for WebWorkerRenderer which is used
   *                     when render mode is 'worker'.
   */
  constructor(
    mode: RenderMode = 'main',
    workerConfig: WebWorkerRendererConfig = {}
  ) {
    this.currentMode = mode
    this.mainThreadRenderer = new MainThreadRenderer()
    this.adapter = this.mainThreadRenderer
    this.workerConfig = workerConfig
    if (mode === 'worker') {
      this.workerManager = new WebWorkerRenderer(workerConfig)
      this.adapter = this.workerManager
    }
  }

  /**
   * Switch between main thread and worker rendering modes
   * @param mode The rendering mode to switch to
   */
  switchMode(mode: RenderMode): void {
    if (this.currentMode === mode) {
      return // Already in the requested mode
    }

    // Clean up current mode
    if (this.currentMode === 'worker' && this.workerManager) {
      this.workerManager.terminate()
      this.workerManager = null
    }

    this.currentMode = mode

    // Initialize new mode
    if (mode === 'worker') {
      this.workerManager = new WebWorkerRenderer(this.workerConfig)
      this.adapter = this.workerManager
    } else {
      this.adapter = this.mainThreadRenderer
    }
  }

  /**
   * Get current rendering mode
   */
  getMode(): RenderMode {
    return this.currentMode
  }

  /**
   * Render MText using the current mode
   */
  async renderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = {
      byLayerColor: 0xffffff,
      byBlockColor: 0xffffff
    }
  ): Promise<MTextObject> {
    return this.adapter.renderMText(mtextContent, textStyle, colorSettings)
  }

  /**
   * Load fonts using the current mode
   */
  async loadFonts(fonts: string[]): Promise<{ loaded: string[] }> {
    return this.adapter.loadFonts(fonts)
  }

  /**
   * Get available fonts using the current mode
   */
  async getAvailableFonts(): Promise<{ fonts: Array<{ name: string[] }> }> {
    return this.adapter.getAvailableFonts()
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.workerManager) {
      this.workerManager.terminate()
      this.workerManager = null
    }
    this.mainThreadRenderer.destroy()
  }
}
