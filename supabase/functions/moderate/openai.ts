// OpenAI adapters for the full check (M2-20; D-13). Only the photo's 480 px thumbnail and its caption are
// sent (architecture §Costs), as a data URL, never a link to the bucket. Both calls time out well inside
// the 10-second budget (FR-SAF-03); a timeout or error throws, so the moment stays in Checking and the
// app's retry calls fn:moderate again (fail closed, rule 4).
//
// OPENAI_BASE_URL exists only so tests can point the adapters at a local stand-in; leave it empty.
import { z } from '../_shared/deps.ts';
import type { SecondOpinion } from './provider.ts';
import type { Scores } from './thresholds.ts';

export interface ScoreResult {
  /** The dated model that answered (omni-moderation-latest resolves to one). */
  model: string;
  scores: Scores;
}

/** Scores a photo (thumbnail + caption) or a piece of text. */
export interface Scorer {
  readonly name: string;
  scoreImage(thumb: Uint8Array, caption: string | null): Promise<ScoreResult>;
  scoreText(text: string): Promise<ScoreResult>;
}

/** Asks a vision model about a borderline photo. */
export interface SecondOpinionSource {
  ask(thumb: Uint8Array, caption: string | null, concern: string): Promise<SecondOpinion>;
}

export interface OpenAIOptions {
  apiKey: string;
  baseUrl?: string;
  /** Default 6 s: leaves room for the bucket read and the database inside FR-SAF-03's 10 s. */
  timeoutMs?: number;
}

export function dataUrl(jpeg: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < jpeg.length; i += 0x8000) binary += String.fromCharCode(...jpeg.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

const ModerationResponse = z.object({
  model: z.string(),
  results: z.array(z.object({ category_scores: z.record(z.string(), z.number()) })).min(1),
});

async function post(opts: OpenAIOptions, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${opts.baseUrl || 'https://api.openai.com'}${path}`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 6000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`OpenAI ${path} answered ${res.status}`);
  }
  return await res.json();
}

/** omni-moderation (free). Asked as omni-moderation-latest (AGENTS.md); the answer names the dated model. */
export function openAIModeration(opts: OpenAIOptions & { model: string }): Scorer {
  const score = async (input: unknown[]): Promise<ScoreResult> => {
    const parsed = ModerationResponse.parse(await post(opts, '/v1/moderations', { model: opts.model, input }));
    return { model: parsed.model, scores: parsed.results[0].category_scores as Scores };
  };
  return {
    name: 'openai-moderation',
    scoreImage: (thumb, caption) =>
      score([
        ...(caption ? [{ type: 'text', text: caption }] : []),
        { type: 'image_url', image_url: { url: dataUrl(thumb) } },
      ]),
    scoreText: (text) => score([{ type: 'text', text }]),
  };
}

const OpinionJson = z.object({
  verdict: z.enum(['allow', 'remove', 'unsure']),
  reason: z.string().min(1).max(300),
});
const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

const INSTRUCTIONS = 'You help moderators of Pickld, a photo diary app for people 13 and older. ' +
  'An automatic check flagged this photo as borderline. Using the community guidelines (no nudity or ' +
  'sexual content, no graphic violence, no self-harm, no hate or harassment, nothing sexualising minors), ' +
  'say whether it should stay (allow), be removed (remove) or needs a closer human look (unsure), with ' +
  'one short sentence a moderator can read in a few seconds. Describe what is visible; do not guess ' +
  "people's identities.";

/** A vision chat model (D-13), paid per call, so it runs only for borderline photos. */
export function openAISecondOpinion(opts: OpenAIOptions & { model: string }): SecondOpinionSource {
  return {
    async ask(thumb, caption, concern) {
      const raw = await post(opts, '/v1/chat/completions', {
        model: opts.model,
        max_completion_tokens: 200,
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Flagged for: ${concern}. Caption: ${caption ? JSON.stringify(caption) : 'none'}` },
              { type: 'image_url', image_url: { url: dataUrl(thumb), detail: 'low' } },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'second_opinion',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['verdict', 'reason'],
              properties: {
                verdict: { type: 'string', enum: ['allow', 'remove', 'unsure'] },
                reason: { type: 'string' },
              },
            },
          },
        },
      });
      const content = ChatResponse.parse(raw).choices[0].message.content;
      const opinion = OpinionJson.parse(JSON.parse(content));
      return { model: opts.model, ...opinion };
    },
  };
}
