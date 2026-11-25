// Hint generation. The model only ever sees the official Beast Academy solution as its method, so
// hints follow the book's way of thinking instead of the model's own.
import { problemImagesCol, type ProblemDoc } from './_mongo';
import { contextText, hintProblem, type HintContext } from './_hintRules';

const MODEL = 'claude-haiku-5-5';

const SYSTEM = `You are a friendly Beast Academy tutor helping a child (about age 9-10) who answered a practice problem wrong at least twice.
You are given the problem and the OFFICIAL Beast Academy solution. The solution is for you only: the child cannot see it, so never mention it.
Your job is to help the child THINK, not to tell them what to do.
Rules:
- Follow the official Beast Academy solution you are given. Every hint must lead toward the way of thinking used in that solution, never toward a different method, shortcut, or strategy of your own, even if you know a faster one.
- Write at most 2 short, encouraging sentences (3 on the third hint) that end with a question for the child to think about.
- Point to the IDEA behind the problem (for example: does order matter, what is left over, what does the remainder mean).
- Never tell the child which operation to do (do not say divide, subtract, multiply, add, or "try doing X"), and never state the answer or any part of it.
- Only use numbers that appear in the problem or in the child's own answer. Never bring in a number from the solution's working (a quotient, remainder, leftover, product, or total).
- If the child's wrong answer shows a clear mistake, gently make them curious about it without saying "wrong".
- Plain text only, no markdown, no emojis.
Examples:
Bad: "Divide your count by 2 to remove the double counting." Good: "When you counted the line from A to E and the line from E to A, how many different lines was that?"
Bad: "Subtract 630 from 671 and see how many more 9s fit." Good: "After your first big jump, is there still some left over that could hold more groups?"`;

const LEVEL: Record<number, string> = {
  1: 'This is the FIRST hint: ask only about the big idea of the problem. Do not mention any specific step.',
  2: 'This is the SECOND hint: ask the child to look again at one part of their own work where the mistake could be, still as a question, without telling them what to do there.',
  3: 'This is the THIRD hint: give one more gentle question about the idea, and suggest they talk it through with a grown-up.',
};

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

/** Used when the model's hints keep breaking the rules: still a question about the idea, never a step. */
export const SAFE_HINT = 'Read the question again slowly. What is it really asking you to find, and does your answer make sense for that?';

type Msg = { role: 'user' | 'assistant'; content: unknown };

async function callModel(key: string, system: string, messages: Msg[], maxTokens = 220): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    // Haiku 5.5 reasons by default (billed as output); a short reply doesn't need it, and it could use up max_tokens.
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, thinking: { type: 'disabled' }, system, messages }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    console.error('[hint] anthropic error', res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
}

/** `level` = which hint this is for the problem (1 = first): later hints get a little more specific, never the step. */
export async function makeHint(p: ProblemDoc, wrongAnswer: string, level = 1, ctx: HintContext = {}): Promise<{ hint: string; ai: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { hint: FALLBACK_HINT, ai: false };
  const ask = (messages: Msg[]) => callModel(key, SYSTEM, messages);
  try {
    const content = [
      { type: 'text', text: `PROBLEM:\n${p.prompt}` },
      ...(await imageBlocks(p.images.question)),
      { type: 'text', text: `OFFICIAL BEAST ACADEMY SOLUTION:\n${p.solution}` },
      ...(await imageBlocks(p.images.solution)),
      ...(contextText(ctx) ? [{ type: 'text', text: contextText(ctx) }] : []),
      { type: 'text', text: `The child's latest wrong answer: ${wrongAnswer.slice(0, 700)}\n\n${LEVEL[Math.min(Math.max(level, 1), 3)]}\nWrite the hint now.` },
    ];
    // numbers the child has already seen (earlier answers and hints) are fine to use again
    const seen = [wrongAnswer, ...(ctx.earlierAnswers ?? []), ...(ctx.earlierHints ?? []).map((h) => h.hint)].join(' ');
    const messages: Msg[] = [{ role: 'user', content }];
    const first = await ask(messages);
    if (first === null) return { hint: FALLBACK_HINT, ai: false };
    const why = hintProblem(first, p, seen);
    if (!why) return { hint: first, ai: true };
    // one retry as a fresh question that names the broken rule. (Replying to its own rejected draft made the
    // model answer conversationally, e.g. "You're right, that hint ...", and the child saw that.)
    const note = { type: 'text', text: `Careful: a draft of this hint was thrown away because ${why}. Write only the hint itself, speaking to the child. Do not mention any draft, earlier hint or rule.` };
    const second = await ask([{ role: 'user', content: [...content, note] }]);
    if (second && !hintProblem(second, p, seen)) return { hint: second, ai: true };
    console.warn('[hint] rules broken twice, using the safe hint:', why);
    return { hint: SAFE_HINT, ai: false };
  } catch (err) {
    console.error('[hint] failed', err);
    return { hint: FALLBACK_HINT, ai: false };
  }
}

const JUDGE = `You check a written answer from a child (about age 9-10) to a Beast Academy logic question that asks them to explain their thinking.
You are given the question and the OFFICIAL Beast Academy solution (for you only; the child cannot see it).
Be generous: accept the answer if it reaches the right conclusion, even if the explanation is short, incomplete, or a little messy.
Only reject it if the conclusion is wrong, missing, or the reason clearly contradicts the solution.
Reply with JSON only: {"ok": true} or {"ok": false, "feedback": "..."}.
The feedback is for the child: 1-2 short, encouraging sentences ending with a question that makes them think about the idea. Never give the answer, never name an operation to do, never mention the solution.`;

export const EXPLAIN_NUDGE = 'Good start! Read the question again: does your answer say what you found, and why it must be true?';

/** Judges a written explanation against the book solution. Partly-right answers that reach the right conclusion pass. */
export async function judgeExplanation(p: ProblemDoc, text: string): Promise<{ ok: boolean; feedback?: string; ai: boolean }> {
  const t = text.trim();
  if (t.length < 2) return { ok: false, feedback: 'Write your answer and a reason in your own words.', ai: false };
  const key = process.env.ANTHROPIC_API_KEY;
  // without the AI we can't judge, so a real attempt is accepted rather than blocking the kid
  if (!key) return { ok: true, ai: false };
  try {
    const content = [
      { type: 'text', text: `QUESTION:\n${p.prompt}` },
      ...(await imageBlocks(p.images.question)),
      { type: 'text', text: `OFFICIAL BEAST ACADEMY SOLUTION:\n${p.solution}` },
      { type: 'text', text: `THE CHILD'S ANSWER:\n${t.slice(0, 1000)}\n\nReply with the JSON now.` },
    ];
    const out = await callModel(key, JUDGE, [{ role: 'user', content }], 200);
    const m = out?.match(/\{[\s\S]*\}/);
    if (!out || !m) return { ok: true, ai: false };
    const j = JSON.parse(m[0]) as { ok?: boolean; feedback?: string };
    if (j.ok) return { ok: true, ai: true };
    const fb = (j.feedback ?? '').trim();
    return { ok: false, feedback: fb && !hintProblem(fb, p, t) ? fb : EXPLAIN_NUDGE, ai: true };
  } catch (err) {
    console.error('[judge] failed', err);
    return { ok: true, ai: false };
  }
}
