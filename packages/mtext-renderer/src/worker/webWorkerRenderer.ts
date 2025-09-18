import * as THREE from 'three';

import { ColorSettings,MTextData, TextStyle } from '../renderer/types';
import { MTextBaseRenderer, MTextObject } from './baseRenderer';

/**
 * Configuration options for WebWorkerRenderer
 */
export interface WebWorkerRendererConfig {
  /**
   * Number of worker instances to create in the pool
   * @default Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))
   */
  poolSize?: number;
  
  /**
   * URL path to the worker script
   * @default './mtext-renderer-worker.js'
   */
  workerUrl?: string;
}

// Worker message types
interface WorkerMessage {
  type: 'render' | 'loadFonts' | 'getAvailableFonts';
  id: string;
  data?: {
    mtextContent?: unknown;
    textStyle?: unknown;
    colorSettings?: unknown;
    fonts?: string[];
  };
}

interface WorkerResponse {
  type: 'render' | 'loadFonts' | 'getAvailableFonts' | 'error';
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Serialized MText data from worker (JSON-based)
interface SerializedMText {
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  box: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  children: SerializedChild[];
}

interface SerializedChild {
  type: 'mesh' | 'line';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  geometry: {
    attributes: {
      [key: string]: {
        arrayBuffer: ArrayBuffer;
        byteOffset: number;
        length: number;
        itemSize: number;
        normalized: boolean;
      };
    };
    index: {
      arrayBuffer: ArrayBuffer;
      byteOffset: number;
      length: number;
      componentType?: 'uint16' | 'uint32';
    } | null;
  };
  material: {
    type: string;
    color: number;
    transparent: boolean;
    opacity: number;
    side?: number;
    linewidth?: number;
  };
}

/**
 * Manages communication with the MText web worker
 */
export class WebWorkerRenderer implements MTextBaseRenderer {
  private workers: Worker[] = [];
  private inFlightPerWorker: number[] = [];
  private pendingRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      workerIndex: number;
    }
  > = new Map();
  private requestId = 0;
  private poolSize: number;
  private readyPromise: Promise<void> | null = null;

  constructor(config: WebWorkerRendererConfig = {}) {
    // Apply default values
    this.poolSize = config.poolSize ?? Math.max(
      1,
      navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2
    );
    const workerUrl = config.workerUrl ?? './mtext-renderer-worker.js';

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(new URL(workerUrl, import.meta.url), { type: 'module' });
      this.attachWorkerHandlers(worker, i);
      this.workers.push(worker);
      this.inFlightPerWorker.push(0);
    }

    // Kick off initialization (each worker fetches its available fonts once)
    void this.ensureInitialized();
  }

  private handleWorkerMessage(response: WorkerResponse) {
    const { id, success, data, error } = response;
    const pendingRequest = this.pendingRequests.get(id);
    if (pendingRequest) {
      this.pendingRequests.delete(id);
      const { workerIndex } = pendingRequest;
      this.inFlightPerWorker[workerIndex] = Math.max(0, this.inFlightPerWorker[workerIndex] - 1);
      if (success) {
        pendingRequest.resolve(data);
      } else {
        pendingRequest.reject(new Error(error || 'Unknown worker error'));
      }
    }
  }

  private attachWorkerHandlers(worker: Worker, index: number) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(event.data);
    };
    worker.onerror = (error) => {
      console.error('Worker error:', error);
      // Reject all requests assigned to this worker
      const idsToReject: string[] = [];
      this.pendingRequests.forEach((value, key) => {
        if (value.workerIndex === index) idsToReject.push(key);
      });
      idsToReject.forEach((id) => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          pending.reject(new Error('Worker error occurred'));
          this.pendingRequests.delete(id);
        }
      });
      this.inFlightPerWorker[index] = 0;
    };
  }

  private pickLeastLoadedWorker(): number {
    let minIndex = 0;
    let minValue = this.inFlightPerWorker[0] ?? 0;
    for (let i = 1; i < this.inFlightPerWorker.length; i++) {
      const value = this.inFlightPerWorker[i] ?? 0;
      if (value < minValue) {
        minValue = value;
        minIndex = i;
      }
    }
    return minIndex;
  }

  private sendMessage<TResponse = unknown>(
    type: WorkerMessage['type'],
    data?: unknown
  ): Promise<TResponse> {
    const workerIndex = this.pickLeastLoadedWorker();
    const worker = this.workers[workerIndex];
    return new Promise<TResponse>((resolve, reject) => {
      const id = `req_${++this.requestId}`;
      this.pendingRequests.set(id, {
        resolve: (value: unknown) => resolve(value as TResponse),
        reject,
        workerIndex,
      });
      this.inFlightPerWorker[workerIndex] = (this.inFlightPerWorker[workerIndex] ?? 0) + 1;
      worker.postMessage({ type, id, data });
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          this.inFlightPerWorker[workerIndex] = Math.max(
            0,
            this.inFlightPerWorker[workerIndex] - 1
          );
          reject(new Error('Worker request timeout'));
        }
      }, 30000);
    });
  }

  private ensureInitialized(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    if (this.workers.length === 0) return Promise.resolve();

    this.readyPromise = Promise.all(
      this.workers.map(
        (worker, index) =>
          new Promise<void>((resolve, reject) => {
            const id = `req_${++this.requestId}`;
            this.pendingRequests.set(id, {
              resolve: () => resolve(),
              reject,
              workerIndex: index,
            });
            this.inFlightPerWorker[index] = (this.inFlightPerWorker[index] ?? 0) + 1;
            worker.postMessage({ type: 'getAvailableFonts', id });
            setTimeout(() => {
              const pending = this.pendingRequests.get(id);
              if (pending) {
                this.pendingRequests.delete(id);
                this.inFlightPerWorker[index] = Math.max(0, this.inFlightPerWorker[index] - 1);
                reject(new Error('Worker init timeout'));
              }
            }, 30000);
          })
      )
    ).then(() => undefined);

    return this.readyPromise;
  }

  /**
   * Render MText in the worker and return serialized data
   */
  async renderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings: ColorSettings = { byLayerColor: 0xffffff, byBlockColor: 0xffffff }
  ): Promise<MTextObject> {
    await this.ensureInitialized();
    const serialized = await this.sendMessage<SerializedMText>('render', {
      mtextContent,
      textStyle,
      colorSettings,
    });
    return this.reconstructMText(serialized);
  }

  /**
   * Load fonts in the worker
   */
  async loadFonts(fonts: string[]): Promise<{ loaded: string[] }> {
    await this.ensureInitialized();
    const results = await Promise.all(
      this.workers.map(
        (worker, index) =>
          new Promise<{ loaded: string[] }>((resolve, reject) => {
            const id = `req_${++this.requestId}`;
            this.pendingRequests.set(id, {
              resolve: (data: unknown) => resolve(data as { loaded: string[] }),
              reject,
              workerIndex: index,
            });
            this.inFlightPerWorker[index] = (this.inFlightPerWorker[index] ?? 0) + 1;
            worker.postMessage({ type: 'loadFonts', id, data: { fonts } });
            setTimeout(() => {
              const pending = this.pendingRequests.get(id);
              if (pending) {
                this.pendingRequests.delete(id);
                this.inFlightPerWorker[index] = Math.max(0, this.inFlightPerWorker[index] - 1);
                reject(new Error('Worker request timeout'));
              }
            }, 30000);
          })
      )
    );
    const aggregated = new Set<string>();
    results.forEach((r) => r.loaded?.forEach((f) => aggregated.add(f)));
    return { loaded: Array.from(aggregated) };
  }

  /**
   * Get available fonts from the worker
   */
  async getAvailableFonts(): Promise<{ fonts: Array<{ name: string[] }> }> {
    // Query a single worker (all should be in sync after loadFonts broadcasts)
    if (this.workers.length === 0) return { fonts: [] };
    await this.ensureInitialized();
    const workerIndex = 0;
    const worker = this.workers[workerIndex];
    return new Promise<{ fonts: Array<{ name: string[] }> }>((resolve, reject) => {
      const id = `req_${++this.requestId}`;
      this.pendingRequests.set(id, {
        resolve: (value: unknown) => resolve(value as { fonts: Array<{ name: string[] }> }),
        reject,
        workerIndex,
      });
      this.inFlightPerWorker[workerIndex] = (this.inFlightPerWorker[workerIndex] ?? 0) + 1;
      worker.postMessage({ type: 'getAvailableFonts', id });
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          this.inFlightPerWorker[workerIndex] = Math.max(
            0,
            this.inFlightPerWorker[workerIndex] - 1
          );
          reject(new Error('Worker request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Reconstruct MText object from JSON serialized data
   */
  reconstructMText(serializedData: SerializedMText): MTextObject {
    const group = new THREE.Group();

    // Reconstruct all child objects
    serializedData.children.forEach((childData) => {
      const geometry = new THREE.BufferGeometry();

      // Reconstruct geometry attributes from ArrayBuffers
      Object.keys(childData.geometry.attributes).forEach((key) => {
        const attr = childData.geometry.attributes[key];
        // Create a new TypedArray view from the transferred ArrayBuffer
        const typedArray = new Float32Array(attr.arrayBuffer, attr.byteOffset, attr.length);
        const bufferAttribute = new THREE.BufferAttribute(
          typedArray,
          attr.itemSize,
          attr.normalized
        );
        geometry.setAttribute(key, bufferAttribute);
      });

      // Reconstruct index if present from ArrayBuffer
      if (childData.geometry.index) {
        const useUint32 = childData.geometry.index.componentType === 'uint32';
        if (useUint32) {
          const indexTypedArray = new Uint32Array(
            childData.geometry.index.arrayBuffer,
            childData.geometry.index.byteOffset,
            childData.geometry.index.length
          );
          geometry.setIndex(new THREE.Uint32BufferAttribute(indexTypedArray, 1));
        } else {
          const indexTypedArray = new Uint16Array(
            childData.geometry.index.arrayBuffer,
            childData.geometry.index.byteOffset,
            childData.geometry.index.length
          );
          geometry.setIndex(new THREE.Uint16BufferAttribute(indexTypedArray, 1));
        }
      }

      // Create material
      let material: THREE.Material;
      if (childData.type === 'mesh') {
        material = new THREE.MeshBasicMaterial({
          color: childData.material.color,
          transparent: childData.material.transparent,
          opacity: childData.material.opacity,
          side: childData.material.side as THREE.Side,
        });
      } else {
        material = new THREE.LineBasicMaterial({
          color: childData.material.color,
          transparent: childData.material.transparent,
          opacity: childData.material.opacity,
          linewidth: childData.material.linewidth,
        });
      }

      // Create mesh or line
      let object: THREE.Object3D;
      if (childData.type === 'mesh') {
        object = new THREE.Mesh(geometry, material as THREE.MeshBasicMaterial);
      } else {
        object = new THREE.Line(geometry, material as THREE.LineBasicMaterial);
      }

      // Ensure geometry has bounding volumes for correct frustum culling
      // This helps prevent objects from being culled as invisible
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }
      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }

      // Set position, rotation, and scale directly (already in world coordinates)
      object.position.set(childData.position.x, childData.position.y, childData.position.z);

      object.quaternion.set(
        childData.rotation.x,
        childData.rotation.y,
        childData.rotation.z,
        childData.rotation.w
      );

      object.scale.set(childData.scale.x, childData.scale.y, childData.scale.z);

      group.add(object);
    });

    // Add transformed bounding box property (already in world coordinates)
    (group as unknown as MTextObject).box = new THREE.Box3(
      new THREE.Vector3(
        serializedData.box.min.x,
        serializedData.box.min.y,
        serializedData.box.min.z
      ),
      new THREE.Vector3(
        serializedData.box.max.x,
        serializedData.box.max.y,
        serializedData.box.max.z
      )
    );

    return group as unknown as MTextObject;
  }

  /**
   * Terminate the worker
   */
  terminate() {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.inFlightPerWorker = [];
    this.readyPromise = null;
    // Reject any remaining pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Renderer terminated'));
    });
    this.pendingRequests.clear();
  }

  destroy(): void {
    this.terminate();
  }
}
