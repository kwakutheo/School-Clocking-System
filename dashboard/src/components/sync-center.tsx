'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, X, Trash2 } from 'lucide-react';
import { getAll, remove, clearSynced, replayQueue, type QueuedRequest } from '@/lib/offline-queue';

export function SyncCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<QueuedRequest[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const fetchItems = useCallback(async () => {
    const all = await getAll();
    setItems(all);
    
    // Auto-clear synced items after 5 seconds of being shown
    if (all.some(i => i.status === 'synced')) {
      setTimeout(async () => {
        await clearSynced();
        const updated = await getAll();
        setItems(updated);
      }, 5000);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchItems();
    setIsOnline(navigator.onLine);

    // Listen for queue updates (from offline-api or sw.ts)
    const onUpdate = () => fetchItems();
    window.addEventListener('sync-center-updated', onUpdate);
    
    // Network status
    const onOnline = () => { setIsOnline(true); fetchItems(); };
    const onOffline = () => { setIsOnline(false); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('sync-center-updated', onUpdate);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [fetchItems]);

  const handleManualSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    await replayQueue();
    await fetchItems();
    setIsSyncing(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    await fetchItems();
  };

  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'failed').length;

  if (items.length === 0 && !isOpen) {
    return null; // Don't show anything if queue is empty
  }

  return (
    <>
      {/* ── Badge / Toggle Button ── */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="sync-center-badge"
        title="Offline Sync Center"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: pendingCount > 0 ? 'var(--warning)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginLeft: 12
        }}
      >
        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
        {pendingCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: 'var(--danger)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 10,
            border: '2px solid var(--bg-body)'
          }}>
            {pendingCount}
          </span>
        )}
      </button>

      {/* ── Drawer Panel ── */}
      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div 
            className="sync-center-panel shadow-lg"
            style={{
              position: 'absolute',
              top: 70,
              right: 20,
              width: 340,
              maxHeight: 450,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-hover)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Offline Sync Center</h3>
                <span style={{ fontSize: '12px', color: isOnline ? 'var(--success)' : 'var(--danger)' }}>
                  {isOnline ? 'Network Connected' : 'Working Offline'}
                </span>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={32} style={{ margin: '0 auto 12px', color: 'var(--success)', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>All offline changes have been synced.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      style={{ 
                        padding: '12px', 
                        borderRadius: 8, 
                        background: 'var(--bg-body)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${
                          item.status === 'synced' ? 'var(--success)' : 
                          item.status === 'failed' ? 'var(--danger)' : 'var(--warning)'
                        }`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {item.label}
                        </span>
                        
                        {item.status === 'pending' && <Clock size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />}
                        {item.status === 'syncing' && <RefreshCw size={14} className="animate-spin" color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />}
                        {item.status === 'synced'  && <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />}
                        {item.status === 'failed'  && (
                          <button onClick={() => handleDelete(item.id)} title="Discard this failed action" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      
                      {item.status === 'failed' && item.failureReason && (
                        <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 8, padding: '6px 8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <AlertCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                            <span>{item.failureReason}</span>
                          </div>
                        </div>
                      )}
                      
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                        <span style={{ textTransform: 'capitalize' }}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pendingCount > 0 && isOnline && (
              <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                <button 
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="btn-primary"
                  style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                >
                  {isSyncing ? 'Syncing...' : 'Retry Sync Now'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
