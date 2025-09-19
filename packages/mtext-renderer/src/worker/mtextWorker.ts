import * as THREE from 'three'

import { FontManager } from '../font'
import { MText } from '../renderer/mtext'
import { StyleManager } from '../renderer/styleManager'
import { ColorSettings, MTextData, TextStyle } from '../renderer/types'

// Worker message types
interface WorkerMessage {
  type: 'render' | 'loadFonts' | 'getAvailableFonts'
  id: string
  data?: {
    mtextContent?: unknown
    textStyle?: unknown
    colorSettings?: unknown
    fonts?: string[]
    isLoadFontsOnDemand?: boolean
  }
}

interface WorkerResponse {
  type: 'render' | 'loadFonts' | 'getAvailableFonts' | 'error'
  id: string
  success: boolean
  data?: unknown
  error?: string
}

// Initialize managers in the worker
const fontManager = FontManager.instance
const styleManager = new StyleManager()

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = event.data

  try {
    switch (type) {
      case 'render': {
        if (!data) throw new Error('Missing data for render message')
        const { mtextContent, textStyle, colorSettings, isLoadFontsOnDemand } =
          data as {
            mtextContent: MTextData
            textStyle: TextStyle
            colorSettings: ColorSettings
            isLoadFontsOnDemand: boolean
          }

        // Create MText instance and draw (loads fonts on demand)
        const mtext = new MText(
          mtextContent,
          textStyle,
          styleManager,
          fontManager,
          colorSettings
        )
        await mtext.draw(isLoadFontsOnDemand)
        mtext.updateMatrixWorld(true)

        // Serialize the MText object for transfer with transferable objects
        const { data: serializedMText, transferableObjects } =
          serializeMText(mtext)

        self.postMessage(
          {
            type: 'render',
            id,
            success: true,
            data: serializedMText
          } as WorkerResponse,
          { transfer: transferableObjects }
        )
        break
      }

      case 'loadFonts': {
        if (!data) throw new Error('Missing data for loadFonts message')
        const { fonts } = data as { fonts: string[] }
        await fontManager.loadFontsByNames(fonts)
        self.postMessage({
          type: 'loadFonts',
          id,
          success: true,
          data: { loaded: fonts }
        } as WorkerResponse)
        break
      }

      case 'getAvailableFonts': {
        const fonts = await FontManager.instance.getAvaiableFonts()

        self.postMessage({
          type: 'getAvailableFonts',
          id,
          success: true,
          data: { fonts }
        } as WorkerResponse)
        break
      }

      default:
        throw new Error(`Unknown message type: ${type}`)
    }
  } catch (error) {
    self.postMessage({
      type,
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse)
  }
})

// Serialize MText object for transfer to main thread using JSON and transferable objects
function serializeMText(mtext: MText): {
  data: unknown
  transferableObjects: ArrayBuffer[]
} {
  // Get the world matrix to capture all transformations
  const worldMatrix = mtext.matrixWorld.clone()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()

  // Decompose the world matrix to get the final position, rotation, and scale
  worldMatrix.decompose(position, quaternion, scale)

  // Transform the bounding box to world coordinates
  const transformedBox = mtext.box.clone()
  transformedBox.applyMatrix4(worldMatrix)

  // Serialize children and collect transferable objects
  const { children, transferableObjects } = serializeChildren(mtext)

  // Create a comprehensive JSON-serializable representation
  const serialized = {
    // Basic properties
    type: 'MText',
    position: {
      x: position.x,
      y: position.y,
      z: position.z
    },
    rotation: {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w
    },
    scale: {
      x: scale.x,
      y: scale.y,
      z: scale.z
    },
    box: {
      min: {
        x: transformedBox.min.x,
        y: transformedBox.min.y,
        z: transformedBox.min.z
      },
      max: {
        x: transformedBox.max.x,
        y: transformedBox.max.y,
        z: transformedBox.max.z
      }
    },
    // Serialize all child objects as JSON
    children
  }

  return { data: serialized, transferableObjects }
}

// Serialize all child objects as JSON with transferable objects
function serializeChildren(mtext: MText): {
  children: unknown[]
  transferableObjects: ArrayBuffer[]
} {
  const children: unknown[] = []
  const allTransferableObjects: ArrayBuffer[] = []

  mtext.traverse(child => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      const geometry = child.geometry
      const material = child.material

      if (geometry instanceof THREE.BufferGeometry) {
        // Get world matrix for transformations
        const worldMatrix = child.matrixWorld.clone()
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3()
        worldMatrix.decompose(position, quaternion, scale)

        // Serialize geometry attributes using transferable objects
        const attributes: Record<string, unknown> = {}
        const transferableObjects: ArrayBuffer[] = []

        if (geometry.attributes) {
          Object.keys(geometry.attributes).forEach(key => {
            const attr = geometry.attributes[key]
            // Create a copy into a new ArrayBuffer to ensure it's transferable (avoid SharedArrayBuffer)
            const src = new Uint8Array(
              attr.array.buffer,
              attr.array.byteOffset,
              attr.array.byteLength
            )
            const copied = src.slice() // guarantees ArrayBuffer backing
            const arrayBuffer = copied.buffer as ArrayBuffer
            transferableObjects.push(arrayBuffer)
            allTransferableObjects.push(arrayBuffer)

            attributes[key] = {
              arrayBuffer: arrayBuffer,
              byteOffset: 0, // Since we copied, offset is 0
              length: attr.array.length,
              itemSize: attr.itemSize,
              normalized: attr.normalized
            }
          })
        }

        // Serialize index if present using transferable objects
        let indexData: {
          arrayBuffer: ArrayBuffer
          byteOffset: number
          length: number
          componentType: 'uint16' | 'uint32'
        } | null = null
        if (geometry.index) {
          const indexArray = geometry.index.array as Uint16Array | Uint32Array
          const srcIndex = new Uint8Array(
            indexArray.buffer,
            indexArray.byteOffset,
            indexArray.byteLength
          )
          const copiedIndex = srcIndex.slice()
          const indexBuffer = copiedIndex.buffer as ArrayBuffer
          transferableObjects.push(indexBuffer)
          allTransferableObjects.push(indexBuffer)
          indexData = {
            arrayBuffer: indexBuffer,
            byteOffset: 0,
            length: indexArray.length,
            componentType:
              indexArray instanceof Uint32Array ? 'uint32' : 'uint16'
          }
        }

        // Serialize material properties
        const materialData: Record<string, unknown> = {
          type: material.type,
          color: material.color ? material.color.getHex() : 0xffffff,
          transparent: material.transparent,
          opacity: material.opacity
        }

        // Add material-specific properties - only include serializable ones
        if ('side' in material && typeof material.side === 'number') {
          materialData.side = material.side
        }
        if ('linewidth' in material && typeof material.linewidth === 'number') {
          materialData.linewidth = material.linewidth
        }

        const childData = {
          type: child instanceof THREE.Mesh ? 'mesh' : 'line',
          position: {
            x: position.x,
            y: position.y,
            z: position.z
          },
          rotation: {
            x: quaternion.x,
            y: quaternion.y,
            z: quaternion.z,
            w: quaternion.w
          },
          scale: {
            x: scale.x,
            y: scale.y,
            z: scale.z
          },
          geometry: {
            attributes,
            index: indexData
          },
          material: materialData
        }

        children.push(childData)
      }
    }
  })

  return { children, transferableObjects: allTransferableObjects }
}
