import { useCallback, useEffect, useMemo, useState } from 'react';
import { PinRequired, fetchCoverage, fetchProgress, saveChapter, saveTask, setPin } from './api';
import { LEVELS, PLANS, isBoxDone } from './plans';
import { LevelPicker } from './components/LevelPicker';
import { Checklist } from './components/Checklist';
import { CompleteDialog } from './components/CompleteDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ProblemDialog } from './components/ProblemDialog';
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
  const [dialog, setDialog] = useState<{ box?: Box; emailed: boolean; levelNo: number; chapterNo: number; whole?: boolean } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ levelNo: number; chapterNo: number; done: boolean } | null>(null);

  // Which problems of the open chapter have their question in the app (and which are solved).
  const [coverage, setCoverage] = useState<Record<string, { available: Set<number>; solved: Set<number> }>>({});
  const [problem, setProblem] = useState<{ level: number; chapter: number; n: number; list: number[] } | null>(null);
  const covKey = route.level ? `${route.level}-${route.chapter}` : null;
  const loadCoverage = useCallback(async (level: number, chapter: number) => {
    try {
      const c = await fetchCoverage(level, chapter);
      setCoverage((prev) => ({ ...prev, [`${level}-${chapter}`]: { available: new Set(c.available), solved: new Set(c.solved) } }));
    } catch {
      /* problems are an extra; the checklist works without them */
    }
  }, []);
  useEffect(() => {
    if (route.level && loaded && !needPin) void loadCoverage(route.level, route.chapter);
  }, [route.level, route.chapter, loaded, needPin, loadCoverage]);
  const cov = (covKey && coverage[covKey]) || { available: new Set<number>(), solved: new Set<number>() };

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      setProblem(null); // leaving the box (e.g. browser back) closes an open problem
    };
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

  // Whole-chapter action (after the confirmation dialog): every task in the chapter on or off at once.
  const applyChapter = async (levelNo: number, chapterNo: number, on: boolean, passcode: string) => {
    const chapter = PLANS[levelNo].chapters.find((c) => c.number === chapterNo)!;
    const ids = chapter.boxes.flatMap((b) => b.tasks.map((t) => t.id));
    const before = done[levelNo];
    setDone((d) => {
      const s = new Set(d[levelNo]);
      ids.forEach((id) => (on ? s.add(id) : s.delete(id)));
      return { ...d, [levelNo]: s };
    });
    try {
      const res = await saveChapter(levelNo, chapterNo, on, passcode);
      setConfirm(null);
      setDone((d) => ({ ...d, [levelNo]: new Set(res.done) }));
      if (on) setDialog({ emailed: false, levelNo, chapterNo, whole: true });
    } catch (e) {
      setDone((d) => ({ ...d, [levelNo]: before })); // roll back
      if (e instanceof PinRequired) setNeedPin(true);
      else if ((e as Error).message === 'wrong_passcode') setConfirmError('Wrong passcode. Ask a grown-up!');
      else {
        setConfirm(null);
        setError((e as Error).message);
      }
    }
  };

  const nextBox = useMemo(() => {
    if (!dialog) return null;
    const plan = PLANS[dialog.levelNo];
    const all = plan.chapters.flatMap((c) => c.boxes.map((b) => ({ c, b })));
    // after a whole-chapter completion, "next" means the first unfinished box in a LATER chapter
    const i = dialog.whole
      ? all.map((x) => x.c.number).lastIndexOf(dialog.chapterNo)
      : all.findIndex((x) => x.b.id === dialog.box!.id);
    const after = all.slice(i + 1).find((x) => !isBoxDone(x.b, done[dialog.levelNo]));
    if (!after) return null;
    return { ...after, index: after.c.boxes.indexOf(after.b) + 1 };
  }, [dialog, done]);

  if (needPin) return <PinScreen onSubmit={(p) => { setPin(p); void load(); }} />;

  return (
    <>
      {error && (
        <div className="banner-error" role="alert">
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
          onChapterAll={(chapterNo, on) => setConfirm({ levelNo: route.level!, chapterNo, done: on })}
          onNavigate={go}
          available={cov.available}
          solved={cov.solved}
          onOpenProblem={(n, list) => setProblem({ level: route.level!, chapter: route.chapter, n, list: list.filter((x) => cov.available.has(x)) })}
        />
      ) : (
        <LevelPicker done={done} onPick={(l) => go(l, 1)} />
      )}
      {confirm && (() => {
        const ch = PLANS[confirm.levelNo].chapters.find((c) => c.number === confirm.chapterNo)!;
        const tasks = ch.boxes.reduce((n, b) => n + b.tasks.length, 0);
        return (
          <ConfirmDialog
            title={confirm.done ? 'Complete the whole chapter?' : 'Undo the whole chapter?'}
            body={
              confirm.done
                ? `This checks off all ${tasks} tasks in ${ch.boxes.length} boxes of Chapter ${ch.number}: ${ch.title}.`
                : `This clears every check mark in Chapter ${ch.number}: ${ch.title}.`
            }
            confirmLabel={confirm.done ? 'Yes, complete it all' : 'Yes, clear it all'}
            danger={!confirm.done}
            passcode
            error={confirmError}
            onCancel={() => { setConfirm(null); setConfirmError(null); }}
            onConfirm={(code) => {
              setConfirmError(null);
              void applyChapter(confirm.levelNo, confirm.chapterNo, confirm.done, code);
            }}
          />
        );
      })()}
      {problem && (
        <ProblemDialog
          level={problem.level}
          chapter={problem.chapter}
          n={problem.n}
          list={problem.list}
          onSolved={() => void loadCoverage(problem.level, problem.chapter)}
          onOpen={(n) => setProblem({ ...problem, n })}
          onClose={() => setProblem(null)}
        />
      )}
      {dialog && (
        <CompleteDialog
          box={dialog.box}
          chapterNo={dialog.chapterNo}
          chapterTitle={dialog.whole ? PLANS[dialog.levelNo].chapters.find((c) => c.number === dialog.chapterNo)!.title : undefined}
          emailed={dialog.emailed}
          next={nextBox ? { title: dialog.whole ? nextBox.c.title : nextBox.b.title, chapter: nextBox.c.number } : null}
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
      <h1 className="sign">BEAST ACADEMY</h1>
      <p>Enter the family PIN</p>
      <input type="password" inputMode="numeric" autoFocus value={v} onChange={(e) => setV(e.target.value)} aria-label="PIN" />
      <button type="submit" className="bn primary">Open</button>
    </form>
  );
}
