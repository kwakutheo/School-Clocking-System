const fs = require('fs');

const files = [
  'd:/source_codes/school_clocking_system/dashboard/src/app/(protected)/holidays/page.tsx',
  'd:/source_codes/school_clocking_system/dashboard/src/app/(protected)/saas-admin/holidays/page.tsx'
];

const modalUI = `
      {/* Global Notification Modal */}
      {notification.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ marginBottom: 20 }}>
              {notification.type === 'error' ? (
                <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} />
              ) : notification.type === 'success' ? (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
              )}
            </div>
            
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>
              {notification.type === 'error' ? 'Error' : notification.type === 'success' ? 'Success' : 'Notice'}
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {notification.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setNotification({ ...notification, isOpen: false })}
                style={{ minWidth: 120 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ marginBottom: 20 }}>
              <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>Are you sure?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete this holiday? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirm({ isOpen: false, id: '' })}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => executeDelete(deleteConfirm.id)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Prompt Modal */}
      {syncPrompt.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: '30px 20px' }}>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)', textAlign: 'center' }}>Sync Official Holidays</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
              Enter year to sync official holidays from Ghana (e.g. 2026, 2027):
            </p>
            <div className="form-group">
              <input 
                type="number" 
                className="form-control" 
                value={syncPrompt.defaultYear} 
                onChange={e => setSyncPrompt({ ...syncPrompt, defaultYear: e.target.value })} 
                placeholder="YYYY" 
                autoFocus 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSyncPrompt({ ...syncPrompt, isOpen: false })}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => executeSyncPublicHolidays(syncPrompt.defaultYear)}>
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
`;

for (const path of files) {
  let content = fs.readFileSync(path, 'utf8');

  // 1. Add states
  content = content.replace(
    'const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});',
    `const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  const [syncPrompt, setSyncPrompt] = useState<{ isOpen: boolean; defaultYear: string }>({ isOpen: false, defaultYear: '' });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };`
  );

  // 2. Change handleDelete to click and execute
  content = content.replace(/const handleDelete = async \(id: string\) => {([\s\S]*?)};/m, `const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async (id: string) => {
    setDeleteConfirm({ isOpen: false, id: '' });
    try {
      await holidaysApi.delete(id);
      mutate();
    } catch (err) {
      showAlert('Failed to delete', 'error');
    }
  };`);

  // Update onClick for delete
  content = content.replace(/onClick=\{\(\) => handleDelete\(h\.id\)\}/g, 'onClick={() => handleDeleteClick(h.id)}');

  // 3. Change handleSyncPublicHolidays to click and execute
  content = content.replace(
    /const handleSyncPublicHolidays = async \(\) => {[\s\S]*?const yearStr = prompt\([^)]+\);[\s\S]*?if \(\!yearStr \|\| isNaN\(Number\(yearStr\)\)\) return;/m,
    `const handleSyncPublicHolidaysClick = () => {
    const nextYear = getGhanaTime().getFullYear() + 1;
    setSyncPrompt({ isOpen: true, defaultYear: nextYear.toString() });
  };

  const executeSyncPublicHolidays = async (yearStr: string) => {
    setSyncPrompt({ ...syncPrompt, isOpen: false });
    if (!yearStr || isNaN(Number(yearStr))) return;`
  );

  // Update onClick for Sync
  content = content.replace(/onClick=\{handleSyncPublicHolidays\}/g, 'onClick={handleSyncPublicHolidaysClick}');

  // 4. Inject Modals before returning the first modal
  content = content.replace(/\{showModal && \(/, `${modalUI}\n      {showModal && (`);

  // 5. Replace alerts
  content = content.replace(/alert\('You cannot manually move a holiday to a weekend\. Please select a valid working day \(Monday–Friday\)\.'\);/g, "showAlert('You cannot manually move a holiday to a weekend. Please select a valid working day (Monday–Friday).', 'error');");
  content = content.replace(/alert\('The custom observed date must be strictly after the original holiday date\.'\);/g, "showAlert('The custom observed date must be strictly after the original holiday date.', 'error');");
  content = content.replace(/alert\(serverMsg \|\| \(editingId \? 'Failed to update holiday' : 'Failed to add holiday'\)\);/g, "showAlert(serverMsg || (editingId ? 'Failed to update holiday' : 'Failed to add holiday'), 'error');");
  content = content.replace(/alert\(\`All public holidays for \$\{yearStr\} are already in your system\.\`\);/g, "showAlert(`All public holidays for \${yearStr} are already in your system.`, 'info');");
  content = content.replace(/alert\('Error syncing public holidays\. Please try again\.'\);/g, "showAlert('Error syncing public holidays. Please try again.', 'error');");
  content = content.replace(/alert\('Please select at least one holiday to import\.'\);/g, "showAlert('Please select at least one holiday to import.', 'error');");
  content = content.replace(/alert\(\`Successfully added \$\{toAdd\.length\} (.*?)\!\`\);/g, "showAlert(`Successfully added \${toAdd.length} $1!`, 'success');");
  content = content.replace(/alert\('Failed to import holidays\.'\);/g, "showAlert('Failed to import holidays.', 'error');");

  fs.writeFileSync(path, content, 'utf8');
}
console.log('Successfully updated holiday alerts');
