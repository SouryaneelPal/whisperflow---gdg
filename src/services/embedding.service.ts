import path from 'node:path';

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DTYPE = 'q8';
// Two levels up from both src/services and dist/services, so the build and the server share it.
const MODELS_DIR = path.join(__dirname, '../../.models');

export type Embedder = (text: string) => Promise<number[]>;

export async function loadEmbedder({ download = false } = {}): Promise<Embedder> {
  // Imported on demand so the native ONNX runtime is only loaded when embeddings are used.
  const { env: hub, pipeline } = await import('@huggingface/transformers');

  hub.cacheDir = MODELS_DIR;
  // The server only reads the copy fetched at build time; it never downloads at runtime.
  hub.allowRemoteModels = download;

  const extract = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: DTYPE });

  // Mean pooling and L2 normalisation match how sentence-transformers uses this model.
  return async (text) => {
    const output = await extract(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  };
}
