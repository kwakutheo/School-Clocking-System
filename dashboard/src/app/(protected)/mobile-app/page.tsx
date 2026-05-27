'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { 
  Download, 
  Copy, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck, 
  Zap,
  Info,
  Printer,
  Share2
} from 'lucide-react';
import styles from './page.module.css';
import { useAuthStore } from '@/lib/store';
import { can } from '@/lib/permissions';
import { useRouter } from 'next/navigation';

export default function MobileAppPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { user, isHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && user && !can(user.role, 'employees.view')) {
      router.push('/dashboard');
    }
  }, [isHydrated, user, router]);

  useEffect(() => {
    // Generate the full download URL based on the current origin
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/download`;
      setDownloadUrl(url);

      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          url,
          {
            width: 500,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          },
          (error) => {
            if (error) console.error('Error generating QR code:', error);
          }
        );
      }
    }
  }, []);

  const handleShareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'TK Clocking App',
          text: 'Download the TK Clocking mobile application here:',
          url: downloadUrl,
        });
      } else {
        // Fallback to clipboard if share is not supported
        await navigator.clipboard.writeText(downloadUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // Ignore AbortError which happens when user cancels the share dialog
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isHydrated || !user) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mobile App Distribution</h1>
        <p className={styles.subtitle}>
          Distribute the TK Clocking mobile application to your employees (Android Only, iOS will be available soon)
        </p>
      </div>

      <div className={styles.content}>
        {/* QR Code Card */}
        <div className={styles.card}>
          {/* Print Only Header */}
          <div className={styles.printHeader}>
            <Image src="/app_logo.png" alt="TK Clocking Logo" width={100} height={100} style={{ borderRadius: '20px', marginBottom: '16px' }} priority={true} />
            <h1 className={styles.printTitle}>TK CLOCKING SYSTEM</h1>
          </div>

          <div className={styles.iconWrapper}>
            <Smartphone size={32} />
          </div>
          <h2 className={styles.cardTitle}>Scan to Download</h2>
          <p className={styles.cardDesc}>
            Have your employees scan this QR code with their mobile device to instantly download and install the clocking app.
          </p>
          
          <div className={styles.qrContainerWrapper}>
            <div className={styles.qrContainer}>
              <canvas ref={canvasRef}></canvas>
              <div className={styles.qrCenterIcon}>
                <Smartphone size={36} color="var(--primary)" />
              </div>
            </div>
            <p className={styles.printFooterText}>Scan to download the mobile app.</p>
          </div>

          <div className={styles.buttonGroup}>
            <a 
              href="/apps/tk_clocking.apk" 
              download="tk_clocking_app.apk"
              className={styles.secondaryButton}
            >
              <Download size={18} />
              Download APK
            </a>
            <button 
              onClick={handleShareLink}
              className={styles.secondaryButton}
            >
              {copied ? <CheckCircle2 size={18} color="var(--success)" /> : <Share2 size={18} />}
              {copied ? 'Copied!' : 'Share Link'}
            </button>
            <button 
              onClick={handlePrint}
              className={styles.secondaryButton}
            >
              <Printer size={18} />
              Print QR Code
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle} style={{ alignSelf: 'flex-start' }}>Installation Guide</h2>
          <p className={styles.cardDesc} style={{ textAlign: 'left', width: '100%' }}>
            Follow these steps to successfully install the application on Android devices:
          </p>

          <ul className={styles.infoList}>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><Download size={18} /></div>
              <div>
                <strong>1. Download the App</strong>
                <br />Scan the QR code or click the download link. The file (APK) will be saved to your device's Downloads folder.
              </div>
            </li>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><ShieldCheck size={18} /></div>
              <div>
                <strong>2. Allow Unknown Sources</strong>
                <br />When opening the downloaded file, your device might prompt you to allow installations from unknown sources. Go to Settings and enable this for your browser or file manager.
              </div>
            </li>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><CheckCircle2 size={18} /></div>
              <div>
                <strong>3. Install & Open</strong>
                <br />Follow the on-screen prompts to complete the installation. Once done, open the app and log in with your employee credentials.
              </div>
            </li>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><Zap size={18} /></div>
              <div>
                <strong>4. Grant Permissions</strong>
                <br />The app requires Camera (to scan branch QR code) and Location (for geofencing) permissions to function correctly. Please grant these when prompted.
              </div>
            </li>
          </ul>

          <div style={{ marginTop: 'auto', paddingTop: '24px', width: '100%' }}>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              padding: '16px', 
              background: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              alignItems: 'center',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <Info size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0 }}>
                This is an internal enterprise application and is not available on the various public Store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
