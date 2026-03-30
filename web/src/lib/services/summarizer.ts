import { pipeline, type SummarizationPipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/distilbart-cnn-6-6";

let _pipeline: SummarizationPipeline | null = null;
let _loading: Promise<SummarizationPipeline> | null = null;

async function getSummarizer(): Promise<SummarizationPipeline> {
  if (_pipeline) return _pipeline;
  if (_loading) return _loading;

  _loading = pipeline("summarization", MODEL_ID, {
    dtype: "fp32",
  }) as Promise<SummarizationPipeline>;

  _pipeline = await _loading;
  _loading = null;
  console.log("[summarizer] Model loaded:", MODEL_ID);
  return _pipeline;
}

const BATCH_SIZE = 10;
const MAX_INPUT_CHARS = 3000;

/**
 * Summarize a single text block using the local model.
 */
async function summarizeChunk(text: string): Promise<string> {
  const summarizer = await getSummarizer();
  // Truncate input to avoid OOM on very long texts
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
  const result = await summarizer(input, {
    max_new_tokens: 150,
    min_length: 30,
  });
  const output = Array.isArray(result) ? result[0] : result;
  return (output as { summary_text: string }).summary_text;
}

/**
 * Summarize an array of news texts into a single summary.
 * Batches texts together, summarizes each batch, then merges if needed.
 */
export async function summarizeNews(
  newsTexts: string[],
  context: string,
): Promise<string> {
  if (newsTexts.length === 0) {
    return context === "general market"
      ? "No general news available."
      : "No specific news available for this asset.";
  }

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < newsTexts.length; i += BATCH_SIZE) {
    batches.push(newsTexts.slice(i, i + BATCH_SIZE));
  }

  const batchSummaries: string[] = [];
  for (const batch of batches) {
    const joined = batch.join("\n---\n");
    const summary = await summarizeChunk(joined);
    batchSummaries.push(summary);
  }

  if (batchSummaries.length === 1) return batchSummaries[0];

  // Merge multiple batch summaries into one
  const merged = batchSummaries.join("\n\n");
  return summarizeChunk(merged);
}
