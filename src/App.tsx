import { useCallback, useEffect, useMemo, useState } from 'react';
import { PinRequired, fetchProgress, saveTask, setPin } from './api';
import { LEVELS, PLANS, isBoxDone } from './plans';
import { LevelPicker } from './components/LevelPicker';
import { Checklist } from './components/Checklist';
import { CompleteDialog } from './components/CompleteDialog';
import type { Box } from './types';

interface Route {
  level: number | null;
  chapter: number;
  box: number | null; // 1-based box within the chapter; null = first unfinished
}

function parseHash(): Route {
  const m = location.hash.match(/^#\/L(\d)(?:\/c(\d+))?(?:\/b(\d+))?/);
  const level = m ? Number(m[1]) : null;
  return { level: level && PLANS[level] ? level : null, chapter: m?.[2] ? Number(m[2]) : 1, box: m?.[3] ? Number(m[3]) : null };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [done, setDone] = useState<Record<number, Set<string>>>({ 4: new Set(), 5: new Set() });
  const [error, setError] = useState<string | null>(null);
  const [needPin, setNeedPin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<{ box: Box; emailed: boolean; levelNo: number; chapterNo: number } | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = useCallback(async () => {
    try {
      const results = await Promise.all(LEVELS.map((l) => fetchProgress(l)));
      setDone({ 4: new Set(results[0].done), 5: new Set(results[1].done) });
      setError(null);
      setNeedPin(false);
    } catch (e) {
      if (e instanceof PinRequired) setNeedPin(true);
      else setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const go = (level: number | null, chapter = 1, box?: number) => {
    location.hash = level ? `#/L${level}/c${chapter}${box ? `/b${box}` : ''}` : '#/';
  };

  const toggle = async (level: number, box: Box, taskId: string) => {
    const next = !done[level].has(taskId);
    const apply = (on: boolean) =>
      setDone((d) => {
        const s = new Set(d[level]);
        if (on) s.add(taskId);
        else s.delete(taskId);
        return { ...d, [level]: s };
      });
    apply(next); // optimistic
    try {
      const res = await saveTask(level, taskId, next);
      setDone((d) => ({ ...d, [level]: new Set(res.done) }));
      if (res.completedBox === box.id) {
        const chapterNo = PLANS[level].chapters.find((c) => c.boxes.some((b) => b.id === box.id))!.number;
        setDialog({ box, emailed: res.emailed, levelNo: level, chapterNo });
      }
    } catch (e) {
      apply(!next); // roll back
      if (e instanceof PinRequired) setNeedPin(true);
      else setError((e as Error).message);
    }
  };

  const nextBox = useMemo(() => {
    if (!dialog) return null;
    const plan = PLANS[dialog.levelNo];
    const all = plan.chapters.flatMap((c) => c.boxes.map((b) => ({ c, b })));
    const i = all.findIndex((x) => x.b.id === dialog.box.id);
    const after = all.slice(i + 1).find((x) => !isBoxDone(x.b, done[dialog.levelNo]));
    if (!after) return null;
    return { ...after, index: after.c.boxes.indexOf(after.b) + 1 };
  }, [dialog, done]);

  if (needPin) return <PinScreen onSubmit={(p) => { setPin(p); void load(); }} />;

  return (
    <>
      {error && (
        <div className="banner" role="alert">
          {error} <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {route.level && !loaded ? (
        <div className="loading">Loading your list…</div>
      ) : route.level ? (
        <Checklist
          level={route.level}
          chapterNo={route.chapter}
          boxNo={route.box}
          done={done}
          onToggle={(box, id) => toggle(route.level!, box, id)}
          onNavigate={go}
        />
      ) : (
        <LevelPicker done={done} onPick={(l) => go(l, 1)} />
      )}
      {dialog && (
        <CompleteDialog
          box={dialog.box}
          chapterNo={dialog.chapterNo}
          emailed={dialog.emailed}
          next={nextBox ? { title: nextBox.b.title, chapter: nextBox.c.number } : null}
          onClose={() => setDialog(null)}
          onNext={() => {
            if (nextBox) go(dialog.levelNo, nextBox.c.number, nextBox.index);
            setDialog(null);
          }}
        />
      )}
    </>
  );
}

function PinScreen({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form className="pin" onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <h1>Beast Academy</h1>
      <p>Enter the family PIN</p>
      <input type="password" inputMode="numeric" autoFocus value={v} onChange={(e) => setV(e.target.value)} aria-label="PIN" />
      <button type="submit">Open</button>
    </form>
  );
}
