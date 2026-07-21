const fs = require('fs');
const path = 'd:/source_codes/school_clocking_system/dashboard/src/app/(protected)/calendar/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add notification state
content = content.replace(
  'const [cloneConfirm, setCloneConfirm] = useState({ isOpen: false, academicYear: \'\', isOverwrite: false });',
  'const [cloneConfirm, setCloneConfirm] = useState({ isOpen: false, academicYear: \'\', isOverwrite: false });\n  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: \'success\' | \'error\' | \'info\' }>({ isOpen: false, message: \'\', type: \'info\' });\n\n  const showAlert = (message: string, type: \'success\' | \'error\' | \'info\' = \'info\') => {\n    setNotification({ isOpen: true, message, type });\n  };'
);

// 2. Add Modal UI before the Clone Confirmation Modal
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

      {/* Clone Confirmation Modal */}`;
content = content.replace('{/* Clone Confirmation Modal */}', modalUI);

// 3. Replace all alert(..) with showAlert(..) based on text content
content = content.replace(/alert\(\`(.*?)\`\)/g, (match, msg) => {
  if (msg.toLowerCase().includes('success')) {
    return `showAlert(\`${msg}\`, 'success')`;
  } else if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
    return `showAlert(\`${msg}\`, 'error')`;
  } else {
    return `showAlert(\`${msg}\`)`;
  }
});

content = content.replace(/alert\('(.*?)'\)/g, (match, msg) => {
  if (msg.toLowerCase().includes('success')) {
    return `showAlert('${msg}', 'success')`;
  } else if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
    return `showAlert('${msg}', 'error')`;
  } else {
    return `showAlert('${msg}')`;
  }
});

content = content.replace(/alert\(\"(.*?)\"\)/g, (match, msg) => {
  if (msg.toLowerCase().includes('success')) {
    return `showAlert("${msg}", 'success')`;
  } else if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
    return `showAlert("${msg}", 'error')`;
  } else {
    return `showAlert("${msg}")`;
  }
});

content = content.replace(/alert\(errMsg \|\| '(.*?)'\)/g, (match, msg) => {
  return `showAlert(errMsg || '${msg}', 'error')`;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated alerts in calendar/page.tsx');
