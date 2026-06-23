'use client';
import { useState } from 'react';
import { attendanceApi } from '@/lib/api';
import { X, CheckCircle, Clock, AlertCircle, MessageSquare, FileText } from 'lucide-react';

interface Props {
  logId: string;
  employeeName: string;
  type?: 'late' | 'early_out'; // Defaults to 'late' for backwards compatibility
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_CATEGORIES = [
  'Transport issues',
  'Medical emergency',
  'Family emergency',
  'Pre-approved by admin',
  'Weather conditions',
  'Other'
];

export function ExcuseLatenessModal({ logId, employeeName, type = 'late', onClose, onSuccess }: Props) {
  const [reason, setReason] = useState(REASON_CATEGORIES[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEarlyOut = type === 'early_out';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      setError('Please provide a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEarlyOut) {
        await attendanceApi.excuseEarlyOut(logId, finalReason);
      } else {
        await attendanceApi.excuseLateness(logId, finalReason);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to excuse ${isEarlyOut ? 'early departure' : 'lateness'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 450, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        <div className="modal-header" style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ 
              width: 44, height: 44, 
              borderRadius: 12, 
              background: isEarlyOut ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              color: isEarlyOut ? '#f59e0b' : '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              {isEarlyOut ? <Clock size={22} /> : <AlertCircle size={22} />}
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {isEarlyOut ? 'Excuse Early Departure' : 'Excuse Lateness'}
              </h2>
              <p className="modal-subtitle" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                For <span style={{ fontWeight: 600, color: 'var(--text)' }}>{employeeName}</span>
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={isSubmitting} title="Close" aria-label="Close modal" style={{ alignSelf: 'flex-start', marginTop: -4, marginRight: -4 }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', background: 'var(--bg-secondary)' }}>
          {error && (
            <div className="error-message" style={{ 
              marginBottom: 20, 
              padding: '10px 14px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: reason === 'Other' ? 16 : 24 }}>
            <label htmlFor="reason-category" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
              <MessageSquare size={14} color="var(--text-secondary)" />
              Reason Category
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id="reason-category"
                title="Reason Category"
                aria-label="Reason Category"
                className="input-field"
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={isSubmitting}
                style={{ 
                  width: '100%', 
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  fontSize: 14,
                  color: 'var(--text)',
                  appearance: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  colorScheme: 'var(--color-scheme)'
                }}
              >
                {REASON_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          {reason === 'Other' && (
            <div className="form-group" style={{ marginBottom: 24, animation: 'fadeIn 0.2s ease-in-out' }}>
              <label htmlFor="custom-reason" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
                <FileText size={14} color="var(--text-secondary)" />
                Specific Reason Details
              </label>
              <textarea
                id="custom-reason"
                title="Specific Reason Details"
                aria-label="Specific Reason Details"
                className="input-field"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                disabled={isSubmitting}
                placeholder="Please describe the reason in detail..."
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  fontSize: 14,
                  resize: 'none',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                required={reason === 'Other'}
              />
            </div>
          )}

          <div className="modal-footer" style={{ 
            marginTop: 8, 
            paddingTop: 20, 
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12
          }}>
            <button 
              type="button" 
              className="btn" 
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 500,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text)'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting || (reason === 'Other' && !customReason.trim())}
              style={{ 
                padding: '10px 24px',
                borderRadius: 8,
                fontWeight: 500,
                background: isEarlyOut ? '#f59e0b' : '#10b981', 
                borderColor: isEarlyOut ? '#f59e0b' : '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 4px 6px -1px ${isEarlyOut ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}, 0 2px 4px -1px ${isEarlyOut ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`
              }}
            >
              <CheckCircle size={18} />
              {isSubmitting ? 'Saving...' : (isEarlyOut ? 'Excuse Early Out' : 'Excuse Lateness')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
