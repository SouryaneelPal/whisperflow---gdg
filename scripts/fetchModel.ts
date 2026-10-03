import { EMBEDDING_MODEL, loadEmbedder } from '../src/services/embedding.service';

async function main() {
  const embed = await loadEmbedder({ download: true });
  const vector = await embed('Model check.');
  console.log(`${EMBEDDING_MODEL} ready in .models (${vector.length} dimensions)`);
}

main().catch((err) => {
  console.error(`Could not fetch the embedding model: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
