export { WebWorkerRenderer as MTextWorkerManager } from './webWorkerRenderer';
export { MainThreadRenderer } from './mainThreadRenderer';
export { UnifiedRenderer } from './unifiedRenderer';
export type { RenderMode } from './unifiedRenderer';
export type { MTextBaseRenderer as MTextRendererAdapter } from './baseRenderer';

// Re-export types for convenience
export type { MTextData, TextStyle, ColorSettings } from '../renderer/types';
