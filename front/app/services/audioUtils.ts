/**
 * Utilidades para procesamiento de audio
 */

/**
 * Convierte Float32Array a Int16Array (PCM16)
 */
export function float32ToPCM16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

/**
 * Convierte PCM16 a Float32Array
 */
export function pcm16ToFloat32(pcm16: Int16Array | Uint8Array): Float32Array {
  const int16Array = pcm16 instanceof Int16Array 
    ? pcm16 
    : new Int16Array(pcm16.buffer);
  
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32[i] = int16Array[i] / 32768.0;
  }
  return float32;
}

/**
 * Calcula el nivel promedio de audio
 */
export function calculateAudioLevel(audioData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += Math.abs(audioData[i]);
  }
  return sum / audioData.length;
}

/**
 * Convierte ArrayBuffer a Float32Array desde PCM16
 */
export async function arrayBufferToFloat32(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const pcm16Data = new Int16Array(arrayBuffer);
  return pcm16ToFloat32(pcm16Data);
}

/**
 * Convierte base64 a Float32Array desde PCM16
 */
export function base64ToFloat32(base64: string): Float32Array {
  const audioBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pcm16 = new Int16Array(audioBytes.buffer);
  return pcm16ToFloat32(pcm16);
}

