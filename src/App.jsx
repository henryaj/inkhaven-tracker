import { useState, useCallback, useEffect, useRef, useLayoutEffect, createContext, useContext } from 'react';
import confetti from 'canvas-confetti';

const EffortsContext = createContext(null);

const STORAGE_KEY = 'inkhaven-tracker-v3';

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#6366f1', '#16a34a', '#fbbf24', '#f87171', '#34d399'],
  });
}

const CHANGELOG = [
  {
    date: '2026-04-06',
    changes: [
      'Added right-click context menu on calendar days (edit, mark published, unassign)',
      'Added confetti effect when marking posts as published',
      'Added confirmation when dragging unassigned posts to published column',
      'Added changelog button',
      'Enter key submits edit modal, Escape dismisses it',
      'Month navigation — click arrows to change month',
      'Added "Prioritised" status between Idea and In Progress — Ideas column is now gray',
    ],
  },
  {
    date: '2026-04-04',
    changes: ['Added bulk import modal and unset effort tier'],
  },
  {
    date: '2026-04-03',
    changes: [
      'Added writing emoji to page title',
      'Added Open Graph and Twitter meta tags for link previews',
    ],
  },
  {
    date: '2026-04-02',
    changes: [
      'Exclude published posts from assigned count',
      'Added Vercel Web Analytics',
      'Underline posts with links, cmd-click to open from calendar',
      'Click kanban cards to edit, cmd-click to open link',
      'Widen layout to 1400px on kanban tab',
      'Colorblind mode with stripe patterns',
      'Simpler calendar badges with status tooltips',
      'Indigo gradient for kanban columns, Geist font',
      'Unified data model: calendar and kanban share single posts array',
      'Initial Inkhaven Tracker app',
    ],
  },
];
const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 3; // April (0-indexed)

function getMonthInfo(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // 0=Monday .. 6=Sunday (ISO week)
  const jsDay = new Date(year, month, 1).getDay(); // 0=Sun
  const firstDow = jsDay === 0 ? 6 : jsDay - 1;
  const name = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
  return { daysInMonth, firstDow, name, year, month };
}

const EFFORTS_BASE = {
  unset: { label: 'Unset', color: '#9ca3af', border: '#d1d5db', bg: '#f9fafb' },
  quick: { label: 'Quick', color: '#059669', border: '#34d399', bg: '#ecfdf5' },
  medium: { label: 'Medium', color: '#d97706', border: '#fbbf24', bg: '#fffbeb' },
  flagship: { label: 'Flagship', color: '#dc2626', border: '#f87171', bg: '#fef2f2' },
};

// Patterns for colorblind mode — applied as backgroundImage on effort bars
const CB_PATTERNS = {
  unset: null, // solid, no pattern
  quick: null, // solid, no pattern
  medium: (color) => `repeating-linear-gradient(0deg, ${color}, ${color} 3px, #fff 3px, #fff 6px)`,
  flagship: (color) => `repeating-linear-gradient(45deg, ${color}, ${color} 2px, #fff 2px, #fff 5px)`,
};

function getEfforts(colorblind) {
  if (!colorblind) return EFFORTS_BASE;
  const efforts = {};
  for (const [k, v] of Object.entries(EFFORTS_BASE)) {
    efforts[k] = { ...v, pattern: CB_PATTERNS[k] ? CB_PATTERNS[k](v.border) : null };
  }
  return efforts;
}

const STATUSES = {
  idea: { label: 'Idea', icon: '○', color: '#6b7280', bg: '#f3f4f6' },
  prioritised: { label: 'Prioritised', icon: '★', color: '#7c3aed', bg: '#ede9fe' },
  inProgress: { label: 'In Progress', icon: '✎', color: '#818cf8', bg: '#e8ecff' },
  hitWordCount: { label: 'Hit Word Count', icon: '✓', color: '#6366f1', bg: '#e0e4ff' },
  readyToPublish: { label: 'Ready to Publish', icon: '◈', color: '#4f46e5', bg: '#dbe0fe' },
  published: { label: 'Published', icon: '✓', color: '#16a34a', bg: '#dcfce7' },
};

const STATUS_ORDER = ['idea', 'prioritised', 'inProgress', 'hitWordCount', 'readyToPublish', 'published'];

function getCurrentDay(year, month) {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() === month) return now.getDate();
  return null; // not the current month
}

function migrateOldData(old) {
  const posts = [];
  if (old.days) {
    for (const [dayStr, entry] of Object.entries(old.days)) {
      posts.push({
        id: `day-${dayStr}-${Date.now()}`,
        title: entry.title || '',
        status: entry.status || 'idea',
        effort: entry.effort || 'quick',
        wordCount: entry.wordCount || 0,
        link: entry.link || '',
        day: Number(dayStr),
      });
    }
  }
  if (old.backlog) {
    for (const item of old.backlog) {
      posts.push({
        id: item.id || `migrated-${Date.now()}-${Math.random()}`,
        title: item.title || '',
        status: item.status || 'idea',
        effort: item.effort || 'quick',
        wordCount: 0,
        link: '',
        day: null,
      });
    }
  }
  return { posts };
}

const SEED_DATA = { posts: [
  { id: 's1', title: 'Why I quit social media for a month', status: 'published', effort: 'flagship', wordCount: 2200, day: 1 },
  { id: 's2', title: '5 journaling prompts that actually work', status: 'published', effort: 'medium', wordCount: 1100, day: 2 },
  { id: 's3', title: 'The case for writing by hand', status: 'published', effort: 'quick', wordCount: 600, day: 3 },
  { id: 's4', title: 'Book review: Bird by Bird', status: 'published', effort: 'medium', wordCount: 1400, day: 4 },
  { id: 's5', title: 'How to outline a blog post in 10 min', status: 'readyToPublish', effort: 'quick', wordCount: 750, day: 5 },
  { id: 's6', title: 'My morning writing routine', status: 'readyToPublish', effort: 'medium', wordCount: 900, day: 6 },
  { id: 's7', title: 'Lessons from 100 days of blogging', status: 'readyToPublish', effort: 'flagship', wordCount: 1800, day: 7 },
  { id: 's8', title: 'Writing when you don\'t feel like it', status: 'hitWordCount', effort: 'medium', wordCount: 1050, day: 8 },
  { id: 's9', title: 'Finding your voice online', status: 'hitWordCount', effort: 'quick', wordCount: 500, day: 9 },
  { id: 's10', title: 'What makes a great opening line?', status: 'inProgress', effort: 'medium', wordCount: 300, day: 10 },
  { id: 's11', title: 'Editing tips from a recovering perfectionist', status: 'inProgress', effort: 'flagship', wordCount: 400, day: null },
  { id: 's12', title: 'The power of writing in public', status: 'idea', effort: 'medium', wordCount: 0, day: null },
  { id: 's13', title: 'How to handle negative comments', status: 'idea', effort: 'quick', wordCount: 0, day: null },
  { id: 's14', title: 'Newsletter vs blog: which is better?', status: 'idea', effort: 'flagship', wordCount: 0, day: null },
  { id: 's15', title: 'Content repurposing strategies', status: 'readyToPublish', effort: 'medium', wordCount: 1200, day: null },
  { id: 's16', title: 'SEO basics for writers', status: 'idea', effort: 'medium', wordCount: 0, day: null },
]};

function loadData() {
  if (new URLSearchParams(window.location.search).has('seed')) {
    return SEED_DATA;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.posts) return parsed;
      if (parsed.days || parsed.backlog) return migrateOldData(parsed);
    }
  } catch (e) { /* ignore */ }
  return { posts: [] };
}

// Helpers to derive views from the unified posts list
function getPostForDay(posts, day) {
  return posts.find(p => p.day === day) || null;
}
function getDayMap(posts) {
  const map = {};
  for (const p of posts) {
    if (p.day != null) map[p.day] = p;
  }
  return map;
}
function getUnassignedPosts(posts) {
  return posts.filter(p => p.day == null);
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState('calendar');
  const [modalDay, setModalDay] = useState(null);
  const [modalPostId, setModalPostId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const saved = localStorage.getItem('inkhaven-view-year');
    return saved ? Number(saved) : DEFAULT_YEAR;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const saved = localStorage.getItem('inkhaven-view-month');
    return saved != null ? Number(saved) : DEFAULT_MONTH;
  });
  const [colorblind, setColorblind] = useState(() => localStorage.getItem('inkhaven-colorblind') === 'true');
  const monthInfo = getMonthInfo(viewYear, viewMonth);
  const currentDay = getCurrentDay(viewYear, viewMonth);
  const EFFORTS = getEfforts(colorblind);

  const changeMonth = (m) => {
    setViewMonth(m);
    localStorage.setItem('inkhaven-view-month', String(m));
  };
  const changeYear = (y) => {
    setViewYear(y);
    localStorage.setItem('inkhaven-view-year', String(y));
  };

  const toggleColorblind = () => {
    setColorblind(prev => {
      const next = !prev;
      localStorage.setItem('inkhaven-colorblind', String(next));
      return next;
    });
  };

  const save = useCallback((newData) => {
    setData(newData);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newData)); } catch (e) { /* ignore */ }
  }, []);

  const update = useCallback((fn) => {
    setData(prev => {
      const next = fn(JSON.parse(JSON.stringify(prev)));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  const reset = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      save({ posts: [] });
      setModalDay(null);
    }
  };

  const posts = data.posts;
  const dayMap = getDayMap(posts);
  const unassigned = getUnassignedPosts(posts);
  const publishedCount = posts.filter(p => p.status === 'published').length;
  const readyOrPublishedScheduled = posts.filter(p => p.day != null && (p.status === 'readyToPublish' || p.status === 'published')).length;
  const readyCount = posts.filter(p => p.status === 'readyToPublish').length;
  const assignedCount = posts.filter(p => p.day != null && p.status !== 'published').length;
  const totalWords = posts.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  const effectiveDay = currentDay || 0;
  const buffer = readyOrPublishedScheduled - effectiveDay;
  const daysLeft = monthInfo.daysInMonth - effectiveDay;

  return (
    <EffortsContext.Provider value={EFFORTS}>
    <div style={{ maxWidth: tab === 'kanban' ? 1400 : 940, margin: '0 auto', padding: '20px 20px 40px', transition: 'max-width 0.2s ease' }}>
      <Header currentDay={currentDay} monthInfo={monthInfo} viewYear={viewYear} viewMonth={viewMonth} onChangeMonth={changeMonth} onChangeYear={changeYear} onReset={reset} colorblind={colorblind} onToggleColorblind={toggleColorblind} onShowChangelog={() => setShowChangelog(true)} />
      <StatsBar publishedCount={publishedCount} daysInMonth={monthInfo.daysInMonth} buffer={buffer} readyCount={readyCount} assignedCount={assignedCount} totalWords={totalWords} />
      <Legend />
      <Tabs tab={tab} setTab={setTab} postCount={posts.length} />

      {tab === 'calendar' ? (
        <Calendar dayMap={dayMap} currentDay={currentDay} monthInfo={monthInfo} onDayClick={setModalDay} onContextMenu={setContextMenu} />
      ) : (
        <Kanban posts={posts} update={update} dragId={dragId} setDragId={setDragId} dropTarget={dropTarget} setDropTarget={setDropTarget} onCardClick={setModalPostId} onImport={() => setShowImport(true)} />
      )}

      {modalDay !== null && (
        <EditModal
          day={modalDay}
          entry={dayMap[modalDay] || null}
          unassigned={unassigned}
          onClose={() => setModalDay(null)}
          update={update}
        />
      )}

      {modalPostId !== null && (() => {
        const post = posts.find(p => p.id === modalPostId);
        if (!post) return null;
        return (
          <EditModal
            day={post.day}
            entry={post}
            unassigned={unassigned}
            onClose={() => setModalPostId(null)}
            update={update}
          />
        );
      })()}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          update={update}
        />
      )}

      {contextMenu && (() => {
        const post = posts.find(p => p.id === contextMenu.postId);
        if (!post) return null;
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            post={post}
            onEdit={() => {
              setModalDay(contextMenu.day);
              setContextMenu(null);
            }}
            onMarkPublished={() => {
              update(d => {
                const p = d.posts.find(p => p.id === contextMenu.postId);
                if (p) p.status = 'published';
                return d;
              });
              fireConfetti();
              setContextMenu(null);
            }}
            onUnassign={() => {
              update(d => {
                const p = d.posts.find(p => p.id === contextMenu.postId);
                if (p) p.day = null;
                return d;
              });
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}

      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}

      <footer style={{ textAlign: 'center', padding: '32px 0 8px', fontSize: 13, color: '#9ca3af' }}>
        A <a href="https://blmc.dev/" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>Bloom Computing</a> production by <a href="https://henrystanley.com" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>Henry Stanley</a>
      </footer>
    </div>
    </EffortsContext.Provider>
  );
}

// ─── Header ───

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Header({ currentDay, monthInfo, viewYear, viewMonth, onChangeMonth, onChangeYear, onReset, colorblind, onToggleColorblind, onShowChangelog }) {
  const btnStyle = {
    fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
    background: '#fff', color: '#6b7280', cursor: 'pointer', fontWeight: 500,
  };
  const pickerStyle = {
    fontSize: 15, fontWeight: 600, color: '#374151', background: 'none',
    border: 'none', cursor: 'pointer', padding: 0,
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937', margin: 0 }}>
          ✍️ Inkhaven Tracker
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <select value={viewMonth} onChange={e => onChangeMonth(Number(e.target.value))} style={pickerStyle}>
            {MONTH_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <select value={viewYear} onChange={e => onChangeYear(Number(e.target.value))} style={pickerStyle}>
            {Array.from({ length: 11 }, (_, i) => 2020 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {currentDay != null && <span> · Day {currentDay} of {monthInfo.daysInMonth} · 500+ words daily</span>}
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
          Data is saved in your browser's local storage and won't sync across devices.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onShowChangelog} style={btnStyle}>Changelog</button>
        <button onClick={onToggleColorblind} style={{
          ...btnStyle,
          background: colorblind ? '#eef2ff' : '#fff',
          color: colorblind ? '#6366f1' : '#6b7280',
          borderColor: colorblind ? '#c7d2fe' : '#e5e7eb',
        }} title="Toggle colourblind-friendly palette">
          {colorblind ? 'CB on' : 'CB off'}
        </button>
        <button onClick={onReset} style={btnStyle}>Reset</button>
      </div>
    </div>
  );
}

// ─── Stats Bar ───

function StatsBar({ publishedCount, daysInMonth, buffer, readyCount, assignedCount, totalWords }) {
  const pills = [
    { label: `✓ ${publishedCount}/${daysInMonth}`, color: '#059669', bg: '#ecfdf5' },
    { label: buffer >= 0 ? `+${buffer} ahead` : `${buffer} behind`, color: buffer >= 0 ? '#059669' : '#dc2626', bg: buffer >= 0 ? '#ecfdf5' : '#fef2f2' },
    { label: `${readyCount} ready`, color: '#4f46e5', bg: '#dbe0fe' },
    { label: `${assignedCount} assigned`, color: '#6366f1', bg: '#eef2ff' },
    ...(totalWords > 0 ? [{ label: `${totalWords.toLocaleString()} words`, color: '#6b7280', bg: '#f3f4f6' }] : []),
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      {pills.map((p, i) => (
        <span key={i} style={{
          fontSize: 15, fontWeight: 600, padding: '5px 14px', borderRadius: 10,
          color: p.color, background: p.bg,
        }}>{p.label}</span>
      ))}
    </div>
  );
}

// ─── Legend ───

function Legend() {
  const EFFORTS = useContext(EffortsContext);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600 }}>Effort:</span>
      {Object.entries(EFFORTS).map(([k, v]) => (
        <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: v.border, backgroundImage: v.pattern || 'none', display: 'inline-block' }} />
          {v.label}
        </span>
      ))}
      <span style={{ color: '#d1d5db', fontSize: 16 }}>│</span>
      <span style={{ fontWeight: 600 }}>Status:</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 18, height: 18, borderRadius: 4, background: '#ecfdf5', color: '#059669', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>✓</span>
        Published
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 18, height: 18, borderRadius: 4, background: '#f3f4f6', color: '#6b7280', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>●</span>
        Ready
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 18, height: 18, borderRadius: 4, background: '#f3f4f6', color: '#9ca3af', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>○</span>
        Not ready
      </span>
    </div>
  );
}

// ─── Tabs ───

function Tabs({ tab, setTab, postCount }) {
  const tabStyle = (active) => ({
    fontSize: 15, fontWeight: 600, padding: '8px 0', marginRight: 24, cursor: 'pointer',
    background: 'none', border: 'none', borderBottom: active ? '2.5px solid #6366f1' : '2.5px solid transparent',
    color: active ? '#6366f1' : '#6b7280', paddingBottom: 6,
  });
  return (
    <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 16, display: 'flex' }}>
      <button style={tabStyle(tab === 'calendar')} onClick={() => setTab('calendar')}>Calendar</button>
      <button style={tabStyle(tab === 'kanban')} onClick={() => setTab('kanban')}>Board ({postCount})</button>
    </div>
  );
}

// ─── Calendar ───

function Calendar({ dayMap, currentDay, monthInfo, onDayClick, onContextMenu }) {
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = [];
  for (let i = 0; i < monthInfo.firstDow; i++) cells.push(null);
  for (let d = 1; d <= monthInfo.daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 4 }}>
        {dayHeaders.map(h => (
          <div key={h} style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textAlign: 'center', padding: '4px 0' }}>{h}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {cells.map((day, i) => day === null ? (
          <div key={`blank-${i}`} style={{ minHeight: 86 }} />
        ) : (
          <DayCell key={day} day={day} entry={dayMap[day] || null} isToday={day === currentDay} isPast={day < currentDay} onClick={() => onDayClick(day)} onContextMenu={onContextMenu} />
        ))}
      </div>
    </div>
  );
}

function DayCell({ day, entry, isToday, isPast, onClick, onContextMenu }) {
  const EFFORTS = useContext(EffortsContext);
  const [hovered, setHovered] = useState(false);
  const hasPost = !!entry;
  const isPublished = hasPost && entry.status === 'published';
  const isReady = hasPost && (entry.status === 'readyToPublish' || entry.status === 'published');

  let bg = '#fafafa';
  if (isPublished) bg = '#f0fdf4';
  else if (hasPost) bg = '#fff';
  else if (isPast) bg = '#fef2f2';

  return (
    <div
      onClick={e => {
        if ((e.metaKey || e.ctrlKey) && hasPost && entry.link) {
          window.open(entry.link, '_blank');
        } else {
          onClick();
        }
      }}
      onContextMenu={e => {
        if (hasPost) {
          e.preventDefault();
          onContextMenu({ x: e.clientX, y: e.clientY, day, postId: entry.id });
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 86, borderRadius: 10, padding: '6px 8px', cursor: 'pointer',
        background: bg,
        border: isToday ? '2.5px solid #6366f1' : '1px solid #f0f0f0',
        ...(hasPost ? getEffortBorderStyle(EFFORTS, entry.effort, 5) : {}),
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 3px 12px rgba(0,0,0,0.08)' : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      }}
    >
      {hasPost && <EffortBar effort={entry.effort} width={5} style={{ borderRadius: 10 }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: 15, fontWeight: isToday ? 800 : 600, color: isToday ? '#6366f1' : '#374151' }}>{day}</span>
        {hasPost && (() => {
          let icon, color, badgeBg;
          if (entry.status === 'published') {
            icon = '✓'; color = '#059669'; badgeBg = '#ecfdf5';
          } else if (entry.status === 'readyToPublish') {
            icon = '●'; color = '#6b7280'; badgeBg = '#f3f4f6';
          } else {
            icon = '○'; color = '#9ca3af'; badgeBg = '#f3f4f6';
          }
          return (
            <span style={{
              fontSize: 10, width: 20, height: 20, borderRadius: 5, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontWeight: 700,
              color, background: badgeBg,
            }}>
              {icon}
            </span>
          );
        })()}
      </div>
      {hasPost ? (
        <>
          <span
            title={STATUSES[entry.status]?.label || 'Idea'}
            style={{
              fontSize: 12.5, fontWeight: 500, lineHeight: '1.3',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flex: 1,
              color: isReady ? '#374151' : '#9ca3af',
              fontStyle: isReady ? 'normal' : 'italic',
              textDecoration: entry.link ? 'underline' : 'none',
              textDecorationColor: '#d1d5db',
              textUnderlineOffset: 2,
            }}
          >{entry.title}</span>
          {entry.wordCount > 0 && (
            <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{entry.wordCount.toLocaleString()}w</span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 12, color: isPast ? '#fca5a5' : '#d1d5db', margin: 'auto', fontWeight: 500 }}>
          {isPast ? 'missed?' : '+'}
        </span>
      )}
    </div>
  );
}

// ─── Edit Modal ───

function EditModal({ day, entry, unassigned, onClose, update }) {
  const saveRef = useRef(null);

  useEffect(() => {
    const handleKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !e.shiftKey && saveRef.current) {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460,
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: '#1f2937' }}>
          Day {day}
        </h2>
        {entry ? (
          <AssignedDayForm day={day} entry={entry} update={update} onClose={onClose} saveRef={saveRef} />
        ) : (
          <EmptyDayForm day={day} unassigned={unassigned} update={update} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function EmptyDayForm({ day, unassigned, update, onClose }) {
  const EFFORTS = useContext(EffortsContext);
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addPost = (effort) => {
    const t = title.trim();
    if (!t) return;
    update(d => {
      d.posts.push({
        id: `post-${Date.now()}`,
        title: t, status: 'idea', effort, wordCount: 0, link: '',
        day,
      });
      return d;
    });
    onClose();
  };

  const assignExisting = (postId) => {
    update(d => {
      const post = d.posts.find(p => p.id === postId);
      if (post) post.day = day;
      return d;
    });
    onClose();
  };

  return (
    <>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
        No post assigned. Type a title or pick from your unassigned posts.
      </p>
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Post title…"
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(EFFORTS).map(([k, v]) => (
          <button key={k} onClick={() => addPost(k)} style={{
            flex: 1, minWidth: 100, padding: '8px 12px', borderRadius: 8, border: 'none',
            background: v.bg, color: v.color, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            Add as {v.label}
          </button>
        ))}
      </div>

      {unassigned.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Assign an existing post</p>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {unassigned.map(item => (
              <div key={item.id} onClick={() => assignExisting(item.id)} style={{
                display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: 8,
                cursor: 'pointer', ...getEffortBorderStyle(EFFORTS, item.effort, 4),
                marginBottom: 4, transition: 'background 0.1s', position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <EffortBar effort={item.effort} width={4} style={{ borderRadius: 8 }} />
                <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{item.title}</span>
                <span style={{ fontSize: 12, color: EFFORTS[item.effort]?.color, fontWeight: 500 }}>
                  {EFFORTS[item.effort]?.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function AssignedDayForm({ day, entry, update, onClose, saveRef }) {
  const EFFORTS = useContext(EffortsContext);
  const [title, setTitle] = useState(entry.title);
  const [status, setStatus] = useState(entry.status);
  const [effort, setEffort] = useState(entry.effort);
  const [wordCount, setWordCount] = useState(entry.wordCount);
  const [link, setLink] = useState(entry.link || '');

  const saveAndClose = () => {
    const becamePublished = status === 'published' && entry.status !== 'published';
    update(d => {
      const post = d.posts.find(p => p.id === entry.id);
      if (post) {
        post.title = title;
        post.status = status;
        post.effort = effort;
        post.wordCount = Number(wordCount) || 0;
        post.link = link;
      }
      return d;
    });
    if (becamePublished) fireConfetti();
    onClose();
  };

  useEffect(() => {
    if (saveRef) saveRef.current = saveAndClose;
  });

  const unassignFromDay = () => {
    update(d => {
      const post = d.posts.find(p => p.id === entry.id);
      if (post) post.day = null;
      return d;
    });
    onClose();
  };

  return (
    <>
      <label style={labelStyle}>Title</label>
      <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>Status</label>
      <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
        {STATUS_ORDER.map(s => (
          <option key={s} value={s}>{STATUSES[s].label}</option>
        ))}
      </select>

      <label style={labelStyle}>Effort</label>
      <select value={effort} onChange={e => setEffort(e.target.value)} style={inputStyle}>
        {Object.entries(EFFORTS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      <label style={labelStyle}>Words</label>
      <input type="number" step={100} value={wordCount} onChange={e => setWordCount(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>Published link</label>
      <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://inkhaven.blog/…" style={inputStyle} />

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={unassignFromDay} style={{
          flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#f3f4f6', color: '#6b7280', fontWeight: 600, fontSize: 14,
        }}>
          Unassign from day
        </button>
        <button onClick={saveAndClose} style={{
          flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 14,
        }}>
          Done
        </button>
      </div>
    </>
  );
}

// ─── Kanban Board ───

function Kanban({ posts, update, dragId, setDragId, dropTarget, setDropTarget, onCardClick, onImport }) {
  const EFFORTS = useContext(EffortsContext);
  const [newTitle, setNewTitle] = useState('');
  const [newEffort, setNewEffort] = useState('quick');

  const addIdea = () => {
    const t = newTitle.trim();
    if (!t) return;
    update(d => {
      d.posts.push({
        id: `post-${Date.now()}`,
        title: t, status: 'idea', effort: newEffort, wordCount: 0, link: '',
        day: null,
      });
      return d;
    });
    setNewTitle('');
  };

  const removePost = (id) => {
    if (!confirm('Permanently delete this post?')) return;
    update(d => {
      d.posts = d.posts.filter(p => p.id !== id);
      return d;
    });
  };

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
  };

  const onDropOnColumn = (targetStatus) => {
    if (!dragId) return;
    const post = posts.find(p => p.id === dragId);
    if (!post) return;
    if (targetStatus === 'published' && post.day === null && post.status !== 'published') {
      if (!confirm("This post isn't assigned to a day yet. Publish anyway?")) {
        setDragId(null);
        setDropTarget(null);
        return;
      }
    }
    const becamePublished = targetStatus === 'published' && post.status !== 'published';
    update(d => {
      const p = d.posts.find(p => p.id === dragId);
      if (p) p.status = targetStatus;
      return d;
    });
    if (becamePublished) fireConfetti();
    setDragId(null);
    setDropTarget(null);
  };

  const onDropOnCard = (targetId, targetStatus) => {
    if (!dragId || dragId === targetId) return;
    const post = posts.find(p => p.id === dragId);
    if (!post) return;
    if (targetStatus === 'published' && post.day === null && post.status !== 'published') {
      if (!confirm("This post isn't assigned to a day yet. Publish anyway?")) {
        setDragId(null);
        setDropTarget(null);
        return;
      }
    }
    const becamePublished = targetStatus === 'published' && post.status !== 'published';
    update(d => {
      const dragPost = d.posts.find(p => p.id === dragId);
      if (!dragPost) return d;
      dragPost.status = targetStatus;
      const filtered = d.posts.filter(p => p.id !== dragId);
      const targetIdx = filtered.findIndex(p => p.id === targetId);
      filtered.splice(targetIdx, 0, dragPost);
      d.posts = filtered;
      return d;
    });
    if (becamePublished) fireConfetti();
    setDragId(null);
    setDropTarget(null);
  };

  const columns = STATUS_ORDER.map(status => ({
    status,
    ...STATUSES[status],
    items: posts.filter(p => (p.status || 'idea') === status),
  }));

  const isEmpty = posts.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addIdea()}
          placeholder="New post idea…"
          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
        />
        <select value={newEffort} onChange={e => setNewEffort(e.target.value)} style={{ ...inputStyle, width: 120, marginBottom: 0 }}>
          {Object.entries(EFFORTS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={addIdea} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1',
          color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Add</button>
        <button onClick={onImport} style={{
          padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
          color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Import</button>
      </div>

      {isEmpty ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40, fontSize: 14 }}>
          No posts yet. Add new ones above.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUS_ORDER.length}, 1fr)`, gap: 10, overflowX: 'auto' }}>
          {columns.map(col => (
            <div
              key={col.status}
              onDragOver={e => { e.preventDefault(); setDropTarget(col.status); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => { e.preventDefault(); onDropOnColumn(col.status); }}
              style={{
                background: dropTarget === col.status ? col.bg : `${col.bg}99`,
                borderRadius: 10, padding: 10, minHeight: 120, minWidth: 140,
                border: dropTarget === col.status ? `2px dashed ${col.color}` : col.status === 'published' ? '2px solid #15803d' : '2px solid transparent',
                transition: 'background 0.15s, border 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, padding: '0 2px' }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 5, background: col.bg, color: col.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>{col.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>({col.items.length})</span>
              </div>
              {col.items.map(item => {
                const effortInfo = EFFORTS[item.effort] || EFFORTS.quick;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={e => onDragStart(e, item.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropTarget(item.id); }}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); onDropOnCard(item.id, col.status); }}
                    onClick={e => {
                      if (e.metaKey || e.ctrlKey) {
                        if (item.link) window.open(item.link, '_blank');
                      } else {
                        onCardClick(item.id);
                      }
                    }}
                    style={{
                      background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6,
                      ...getEffortBorderStyle(EFFORTS, item.effort, 4),
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      opacity: dragId === item.id ? 0.4 : 1,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderTop: dropTarget === item.id && dragId !== item.id ? `2px solid ${col.color}` : '2px solid transparent',
                      transition: 'opacity 0.15s',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <EffortBar effort={item.effort} width={4} style={{ borderRadius: 8 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, lineHeight: '1.3', display: 'block', textDecoration: item.link ? 'underline' : 'none', textDecorationColor: '#d1d5db', textUnderlineOffset: 2 }}>{item.title}</span>
                      {item.day != null && (
                        <span style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, display: 'block' }}>Day {item.day}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removePost(item.id); }}
                      style={{
                        background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer',
                        fontSize: 14, padding: '0 0 0 8px', lineHeight: 1, flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Import Modal ───

function ImportModal({ onClose, update }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const doImport = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    update(d => {
      for (const title of lines) {
        d.posts.push({
          id: `import-${Date.now()}-${Math.random()}`,
          title, status: 'idea', effort: 'unset', wordCount: 0, link: '',
          day: null,
        });
      }
      return d;
    });
    onClose();
  };

  const lineCount = text.split('\n').filter(l => l.trim().length > 0).length;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#1f2937' }}>
          Import ideas
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
          One post title per line. All imported as ideas with unset effort.
        </p>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'My first post idea\nAnother post idea\nA third one'}
          rows={10}
          style={{
            ...inputStyle, marginBottom: 8, resize: 'vertical',
            minHeight: 160, lineHeight: '1.6',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            {lineCount} {lineCount === 1 ? 'idea' : 'ideas'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={doImport} disabled={lineCount === 0} style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: lineCount > 0 ? '#6366f1' : '#e5e7eb',
              color: lineCount > 0 ? '#fff' : '#9ca3af',
              fontWeight: 600, fontSize: 14,
            }}>Import {lineCount > 0 ? lineCount : ''}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Context Menu ───

function ContextMenu({ x, y, post, onEdit, onMarkPublished, onUnassign, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [hoveredIdx, setHoveredIdx] = useState(null);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setPos({
        left: x + rect.width > window.innerWidth ? x - rect.width : x,
        top: y + rect.height > window.innerHeight ? y - rect.height : y,
      });
    }
  }, [x, y]);

  const items = [
    { label: 'Edit', onClick: onEdit },
    ...(post.status !== 'published' ? [{ label: 'Mark as Published', onClick: onMarkPublished }] : []),
    { label: 'Unassign from Day', onClick: onUnassign },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1001 }} />
      <div ref={menuRef} style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 1002,
        background: '#fff', borderRadius: 10, padding: '4px 0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
        minWidth: 180,
      }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            onClick={item.onClick}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              padding: '8px 14px', fontSize: 13, color: '#374151', cursor: 'pointer',
              fontWeight: 500, background: hoveredIdx === i ? '#f3f4f6' : 'transparent',
            }}
          >{item.label}</div>
        ))}
      </div>
    </>
  );
}

// ─── Changelog Modal ───

function ChangelogModal({ onClose }) {
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460,
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: '#1f2937' }}>Changelog</h2>
        {CHANGELOG.map(entry => (
          <div key={entry.date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>{entry.date}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {entry.changes.map((c, i) => (
                <li key={i} style={{ fontSize: 13, color: '#374151', lineHeight: '1.6' }}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
        <button onClick={onClose} style={{
          marginTop: 8, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 14, width: '100%',
        }}>Close</button>
      </div>
    </div>
  );
}

// ─── Effort Bar ───

function EffortBar({ effort, width = 5, style = {} }) {
  const EFFORTS = useContext(EffortsContext);
  const info = EFFORTS[effort] || EFFORTS.quick;
  if (info.pattern) {
    return (
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width,
        borderRadius: `${style.borderRadius || 10}px 0 0 ${style.borderRadius || 10}px`,
        backgroundImage: info.pattern,
        ...style,
      }} />
    );
  }
  return null;
}

function getEffortBorderStyle(EFFORTS, effort, width = 5) {
  const info = EFFORTS[effort];
  if (!info) return {};
  if (info.pattern) return { paddingLeft: width + 4 };
  return { borderLeftWidth: width, borderLeftColor: info.border, borderLeftStyle: 'solid' };
}

// ─── Shared Styles ───

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  fontSize: 15, outline: 'none', marginBottom: 12, fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4, marginTop: 4,
};
