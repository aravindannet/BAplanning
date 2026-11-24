// Completion email via Resend's REST API (no SDK needed). With no RESEND_API_KEY the message is
// only logged, so local development and first deploys work without any email setup.

export interface BoxCompleteInfo {
  level: number;
  chapterNumber: number;
  chapterTitle: string;
  boxTitle: string;
  taskCount: number;
  boxesDoneInChapter: number;
  boxesInChapter: number;
}

export async function sendBoxComplete(info: BoxCompleteInfo): Promise<boolean> {
  const subject = `Beast Academy: "${info.boxTitle}" is done! (Level ${info.level}, Ch. ${info.chapterNumber})`;
  const text = [
    `"${info.boxTitle}" was just completed.`,
    ``,
    `Level ${info.level} · Chapter ${info.chapterNumber}: ${info.chapterTitle}`,
    `All ${info.taskCount} tasks checked off (guide, online, practice).`,
    `Chapter progress: ${info.boxesDoneInChapter} of ${info.boxesInChapter} boxes done.`,
  ].join('\n');

  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO;
  if (!key || !to) {
    console.log('[notify] email not configured (RESEND_API_KEY / NOTIFY_TO); would have sent:\n' + subject + '\n' + text);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'Beast Academy <onboarding@resend.dev>',
      to: to.split(',').map((s) => s.trim()).filter(Boolean),
      subject,
      text,
    }),
  });
  if (!res.ok) {
    console.error('[notify] Resend error', res.status, await res.text());
    return false;
  }
  return true;
}
