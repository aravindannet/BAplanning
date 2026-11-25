// Hint generation. The model only ever sees the official Beast Academy solution as its method, so
// hints follow the book's way of thinking instead of the model's own.
import { problemImagesCol, type ProblemDoc } from './_mongo';

const MODEL = 'claude-haiku-5-5';

const SYSTEM = `You are a friendly Beast Academy tutor helping a child (about age 9-10) who answered a practice problem wrong twice.
You are given the problem and the OFFICIAL Beast Academy solution.
Rules:
- Give a HINT only: 1-3 short, encouraging sentences.
- Use ONLY the method shown in the official solution. Never introduce a different method or shortcut.
- Never state the final answer and never do the last step for the child. Point to the next idea or the step they should look at again.
- If the child's wrong answer shows a clear mistake, gently point toward it without saying "wrong".
- Plain text only, no markdown, no emojis.`;

export const FALLBACK_HINT = 'Take another look at the problem and work through it one step at a time. Check the Guide page in your book for a similar example!';

async function imageBlocks(ids: string[]) {
  if (!ids.length) return [];
  const col = await problemImagesCol();
  const docs = await col.find({ _id: { $in: ids } }).toArray();
  return docs.map((d) => ({
    type: 'image',
    source: { type: 'base64', media_type: d.mime, data: Buffer.from(d.data.buffer).toString('base64') },
  }));
}

export async function makeHint(p: ProblemDoc, wrongAnswer: string): Promise<{ hint: string; ai: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { hint: FALLBACK_HINT, ai: false };
  try {
    const content = [
      { type: 'text', text: `PROBLEM:\n${p.prompt}` },
      ...(await imageBlocks(p.images.question)),
      { type: 'text', text: `OFFICIAL BEAST ACADEMY SOLUTION:\n${p.solution}` },
      ...(await imageBlocks(p.images.solution)),
      { type: 'text', text: `The child's latest wrong answer: ${wrongAnswer.slice(0, 200)}\n\nWrite the hint now.` },
    ];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      // Haiku 5.5 reasons by default (billed as output); a short hint doesn't need it, and it could use up max_tokens.
      body: JSON.stringify({ model: MODEL, max_tokens: 220, thinking: { type: 'disabled' }, system: SYSTEM, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error('[hint] anthropic error', res.status, (await res.text()).slice(0, 300));
      return { hint: FALLBACK_HINT, ai: false };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    let hint = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
    // Belt and braces: never leak an answer the model echoed. Whole-token match only ("70" must not
    // trip on "700"), and only for answers of 3+ characters (a lone digit appears in hints legitimately).
    for (const part of p.parts) {
      const a = part.answer.trim();
      if (a.length < 3) continue;
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?<![\\w.,])${esc}(?![\\w]|[.,]\\d)`, 'i').test(hint)) hint = FALLBACK_HINT;
    }
    return { hint: hint || FALLBACK_HINT, ai: Boolean(hint) };
  } catch (err) {
    console.error('[hint] failed', err);
    return { hint: FALLBACK_HINT, ai: false };
  }
}
