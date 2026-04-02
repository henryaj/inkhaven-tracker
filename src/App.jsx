import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'inkhaven-tracker-v3';
const DAYS_IN_APRIL = 30;
const APRIL_1_DOW = 2; // Wednesday, 0-indexed from Monday

const EFFORTS = {
  quick: { label: 'Quick', color: '#059669', border: '#34d399', bg: '#ecfdf5' },
  medium: { label: 'Medium', color: '#d97706', border: '#fbbf24', bg: '#fffbeb' },
  flagship: { label: 'Flagship', color: '#dc2626', border: '#f87171', bg: '#fef2f2' },
};

const STATUSES = {
  idea: { label: 'Idea', icon: '○', color: '#6366f1', bg: '#eef2ff' },
  inProgress: { label: 'In Progress', icon: '✎', color: '#d97706', bg: '#fffbeb' },
  hitWordCount: { label: 'Hit Word Count', icon: '✓', color: '#059669', bg: '#ecfdf5' },
  readyToPublish: { label: 'Ready to Publish', icon: '◈', color: '#7c3aed', bg: '#f5f3ff' },
  published: { label: 'Published', icon: '✓', color: '#059669', bg: '#ecfdf5' },
};

const STATUS_ORDER = ['idea', 'inProgress', 'hitWordCount', 'readyToPublish', 'published'];

function getCurrentDay() {
  const now = new Date();
  if (now.getFullYear() === 2026 && now.getMonth() === 3) {
    return now.getDate();
  }
  return 2;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { days: {}, backlog: [] };
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState('calendar');
  const [modalDay, setModalDay] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const currentDay = getCurrentDay();

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
      const empty = { days: {}, backlog: [] };
      save(empty);
      setModalDay(null);
    }
  };

  // Stats
  const days = data.days;
  const backlog = data.backlog;
  const publishedCount = Object.values(days).filter(d => d.status === 'published').length;
  const assignedCount = Object.keys(days).length;
  const totalWords = Object.values(days).reduce((sum, d) => sum + (d.wordCount || 0), 0);
  const buffer = publishedCount - currentDay;
  const daysLeft = DAYS_IN_APRIL - currentDay;

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '20px 20px 40px' }}>
      <Header currentDay={currentDay} onReset={reset} />
      <StatsBar publishedCount={publishedCount} buffer={buffer} assignedCount={assignedCount} totalWords={totalWords} daysLeft={daysLeft} />
      <Legend />
      <Tabs tab={tab} setTab={setTab} backlogCount={backlog.length} />

      {tab === 'calendar' ? (
        <Calendar days={days} currentDay={currentDay} onDayClick={setModalDay} />
      ) : (
        <Backlog backlog={backlog} update={update} dragId={dragId} setDragId={setDragId} dropTarget={dropTarget} setDropTarget={setDropTarget} />
      )}

      {modalDay !== null && (
        <EditModal
          day={modalDay}
          entry={days[String(modalDay)]}
          backlog={backlog}
          onClose={() => setModalDay(null)}
          update={update}
        />
      )}

      <footer style={{ textAlign: 'center', padding: '32px 0 8px', fontSize: 13, color: '#9ca3af' }}>
        A <a href="https://blmc.dev/" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>Bloom Computing</a> production by <a href="https://henrystanley.com" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>Henry Stanley</a>
      </footer>
    </div>
  );
}

// ─── Header ───

function Header({ currentDay, onReset }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#1f2937', margin: 0 }}>
          Inkhaven Tracker
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', marginTop: 4 }}>
          April 2026 · Day {currentDay} of 30 · 500+ words daily
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
          Data is saved in your browser's local storage and won't sync across devices.
        </p>
      </div>
      <button onClick={onReset} style={{
        fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
        background: '#fff', color: '#6b7280', cursor: 'pointer', fontWeight: 500,
      }}>Reset</button>
    </div>
  );
}

// ─── Stats Bar ───

function StatsBar({ publishedCount, buffer, assignedCount, totalWords, daysLeft }) {
  const pills = [
    { label: `✓ ${publishedCount}/30`, color: '#059669', bg: '#ecfdf5' },
    { label: buffer >= 0 ? `+${buffer} ahead` : `${buffer} behind`, color: buffer >= 0 ? '#059669' : '#dc2626', bg: buffer >= 0 ? '#ecfdf5' : '#fef2f2' },
    { label: `${assignedCount} assigned`, color: '#6366f1', bg: '#eef2ff' },
    ...(totalWords > 0 ? [{ label: `${totalWords.toLocaleString()} words`, color: '#6b7280', bg: '#f3f4f6' }] : []),
    { label: `${daysLeft}d left`, color: '#6b7280', bg: '#f3f4f6' },
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600 }}>Effort:</span>
      {Object.entries(EFFORTS).map(([k, v]) => (
        <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: v.border, display: 'inline-block' }} />
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
        <span style={{ width: 18, height: 18, borderRadius: 4, background: '#f3f4f6', color: '#6b7280', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>○</span>
        Not yet
      </span>
    </div>
  );
}

// ─── Tabs ───

function Tabs({ tab, setTab, backlogCount }) {
  const tabStyle = (active) => ({
    fontSize: 15, fontWeight: 600, padding: '8px 0', marginRight: 24, cursor: 'pointer',
    background: 'none', border: 'none', borderBottom: active ? '2.5px solid #6366f1' : '2.5px solid transparent',
    color: active ? '#6366f1' : '#6b7280', paddingBottom: 6,
  });
  return (
    <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 16, display: 'flex' }}>
      <button style={tabStyle(tab === 'calendar')} onClick={() => setTab('calendar')}>Calendar</button>
      <button style={tabStyle(tab === 'backlog')} onClick={() => setTab('backlog')}>Backlog ({backlogCount})</button>
    </div>
  );
}

// ─── Calendar ───

function Calendar({ days, currentDay, onDayClick }) {
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = [];
  for (let i = 0; i < APRIL_1_DOW; i++) cells.push(null);
  for (let d = 1; d <= DAYS_IN_APRIL; d++) cells.push(d);
  while (cells.length < 35) cells.push(null);

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
          <DayCell key={day} day={day} entry={days[String(day)]} isToday={day === currentDay} isPast={day < currentDay} onClick={() => onDayClick(day)} />
        ))}
      </div>
    </div>
  );
}

function DayCell({ day, entry, isToday, isPast, onClick }) {
  const [hovered, setHovered] = useState(false);
  const hasPost = !!entry;
  const isPublished = hasPost && entry.status === 'published';

  let bg = '#fafafa';
  if (isPublished) bg = '#f0fdf4';
  else if (hasPost) bg = '#fff';
  else if (isPast) bg = '#fef2f2';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 86, borderRadius: 10, padding: '6px 8px', cursor: 'pointer',
        background: bg,
        border: isToday ? '2.5px solid #6366f1' : '1px solid #f0f0f0',
        borderLeftWidth: hasPost ? 5 : undefined,
        borderLeftColor: hasPost ? EFFORTS[entry.effort]?.border : undefined,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 3px 12px rgba(0,0,0,0.08)' : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: 15, fontWeight: isToday ? 800 : 600, color: isToday ? '#6366f1' : '#374151' }}>{day}</span>
        {hasPost && (
          <span style={{
            fontSize: 10, width: 20, height: 20, borderRadius: 5, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            color: isPublished ? '#059669' : '#6b7280',
            background: isPublished ? '#ecfdf5' : '#f3f4f6',
          }}>
            {isPublished ? '✓' : '○'}
          </span>
        )}
      </div>
      {hasPost ? (
        <>
          <span style={{
            fontSize: 12.5, fontWeight: 500, color: '#374151', lineHeight: '1.3',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flex: 1,
          }}>{entry.title}</span>
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

function EditModal({ day, entry, backlog, onClose, update }) {
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
          <AssignedDayForm day={day} entry={entry} update={update} onClose={onClose} />
        ) : (
          <EmptyDayForm day={day} backlog={backlog} update={update} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function EmptyDayForm({ day, backlog, update, onClose }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addPost = (effort) => {
    const t = title.trim();
    if (!t) return;
    update(d => {
      d.days[String(day)] = { title: t, status: 'idea', effort, wordCount: 0, link: '' };
      return d;
    });
    onClose();
  };

  const assignFromBacklog = (item) => {
    update(d => {
      d.days[String(day)] = { title: item.title, status: 'idea', effort: item.effort, wordCount: 0, link: '' };
      d.backlog = d.backlog.filter(b => b.id !== item.id);
      return d;
    });
    onClose();
  };

  return (
    <>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
        No post assigned. Type a title or pick from your backlog.
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

      {backlog.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Assign from backlog</p>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {backlog.map(item => (
              <div key={item.id} onClick={() => assignFromBacklog(item)} style={{
                display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: 8,
                cursor: 'pointer', borderLeft: `4px solid ${EFFORTS[item.effort]?.border || '#e5e7eb'}`,
                marginBottom: 4, transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
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

function AssignedDayForm({ day, entry, update, onClose }) {
  const [title, setTitle] = useState(entry.title);
  const [status, setStatus] = useState(entry.status);
  const [effort, setEffort] = useState(entry.effort);
  const [wordCount, setWordCount] = useState(entry.wordCount);
  const [link, setLink] = useState(entry.link || '');

  const saveAndClose = () => {
    update(d => {
      d.days[String(day)] = { title, status, effort, wordCount: Number(wordCount) || 0, link };
      return d;
    });
    onClose();
  };

  const removeToBacklog = () => {
    update(d => {
      const e = d.days[String(day)];
      d.backlog.push({ id: `backlog-${Date.now()}`, title: e.title, effort: e.effort, status: e.status || 'idea' });
      delete d.days[String(day)];
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
        <button onClick={removeToBacklog} style={{
          flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 14,
        }}>
          Remove → backlog
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

// ─── Kanban Backlog ───

function Backlog({ backlog, update, dragId, setDragId, dropTarget, setDropTarget }) {
  const [newTitle, setNewTitle] = useState('');
  const [newEffort, setNewEffort] = useState('quick');

  const addIdea = () => {
    const t = newTitle.trim();
    if (!t) return;
    update(d => {
      d.backlog.push({ id: `new-${Date.now()}`, title: t, effort: newEffort, status: 'idea' });
      return d;
    });
    setNewTitle('');
  };

  const removeItem = (id) => {
    update(d => {
      d.backlog = d.backlog.filter(b => b.id !== id);
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

  const onDropOnColumn = (status) => {
    if (!dragId) return;
    update(d => {
      const item = d.backlog.find(b => b.id === dragId);
      if (item) item.status = status;
      return d;
    });
    setDragId(null);
    setDropTarget(null);
  };

  const onDropOnCard = (targetId, status) => {
    if (!dragId || dragId === targetId) return;
    update(d => {
      const dragItem = d.backlog.find(b => b.id === dragId);
      if (!dragItem) return d;
      dragItem.status = status;
      const filtered = d.backlog.filter(b => b.id !== dragId);
      const targetIdx = filtered.findIndex(b => b.id === targetId);
      filtered.splice(targetIdx, 0, dragItem);
      d.backlog = filtered;
      return d;
    });
    setDragId(null);
    setDropTarget(null);
  };

  const columns = STATUS_ORDER.map(status => ({
    status,
    ...STATUSES[status],
    items: backlog.filter(b => (b.status || 'idea') === status),
  }));

  const isEmpty = backlog.length === 0;

  return (
    <div>
      {/* Add row */}
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
      </div>

      {isEmpty ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40, fontSize: 14 }}>
          No ideas yet. Add new ones above.
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
                background: dropTarget === col.status ? col.bg : '#f9fafb',
                borderRadius: 10, padding: 10, minHeight: 120, minWidth: 140,
                border: dropTarget === col.status ? `2px dashed ${col.color}` : '2px solid transparent',
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
                    style={{
                      background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6,
                      borderLeft: `4px solid ${effortInfo.border}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      opacity: dragId === item.id ? 0.4 : 1,
                      cursor: 'grab',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderTop: dropTarget === item.id && dragId !== item.id ? `2px solid ${col.color}` : '2px solid transparent',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, lineHeight: '1.3' }}>{item.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
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

// ─── Shared Styles ───

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  fontSize: 15, outline: 'none', marginBottom: 12, fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4, marginTop: 4,
};
