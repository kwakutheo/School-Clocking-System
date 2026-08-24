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
  Share2,
  MonitorPlay,
  ChevronDown,
  ChevronUp,
  TriangleAlert
} from 'lucide-react';
import styles from './page.module.css';
import { useAuthStore, usePwaStore } from '@/lib/store';
import { can } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import {
  detectPreferredDownload,
  fallbackMobileAppManifest,
  fetchMobileAppManifest,
  formatApkSize,
  getFriendlyDownloadOptions,
  type ApkDownloadKey,
  type MobileAppManifest,
} from '@/lib/mobile-app-downloads';

export default function MobileAppPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [manifest, setManifest] = useState<MobileAppManifest>(
    fallbackMobileAppManifest,
  );
  const [preferredKey, setPreferredKey] =
    useState<ApkDownloadKey>('universal');
  const [showOptions, setShowOptions] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { user, isHydrated } = useAuthStore();
  const { installEvent, setInstallEvent } = usePwaStore();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && user && !can(user.role, 'employees.view')) {
      router.push('/dashboard');
    }
  }, [isHydrated, user, router]);

  useEffect(() => {
    let cancelled = false;

    fetchMobileAppManifest().then(async (nextManifest) => {
      if (cancelled) return;
      const preferred = await detectPreferredDownload(nextManifest, navigator);
      if (cancelled) return;
      setManifest(nextManifest);
      setPreferredKey(preferred.key);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleInstallPwa = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallEvent(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isHydrated || !user) return null;

  const preferredDownload = manifest.downloads[preferredKey];
  const downloadOptions = getFriendlyDownloadOptions(manifest, preferredKey);

  return (
    <div className="dashboard-container">
      <div className={`page-header ${styles.pageHeaderWrapper}`} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)' }}>
            <Smartphone size={28} style={{ color: 'var(--primary)' }} /> 
            Mobile App Download
          </h1>
        </div>
        <p className="page-subtitle">
          Distribute the TK Clocking mobile application to your staff (Android Only, iOS will be available soon)
        </p>
      </div>

      <div className={styles.content}>
        {/* QR Code Card */}
        <div className={styles.card}>
          {/* Print Only Header */}
          <div className={styles.printHeader}>
            <Image src="/app_logo.png" alt="TK Clocking Logo" width={100} height={100} style={{ borderRadius: '20px', marginBottom: '16px' }} priority={true} />
            <h1 className={styles.printTitle}>TK CLOCKING SYSTEM</h1>
            <h2 className={styles.printSubtitle}>Mobile App Download</h2>
          </div>

          <h2 className={styles.cardTitle}>Scan to Download</h2>
          <p className={styles.cardDesc}>
            Have your staff scan this QR code with their mobile device to instantly download and install the clocking app.
          </p>
          
          <div className={styles.qrContainerWrapper}>
            <div className={styles.qrContainer}>
              <canvas ref={canvasRef}></canvas>
            </div>
            <p className={styles.printFooterText}>Scan to download the mobile app.</p>
          </div>

          <div className={styles.buttonGroup}>
            <a 
              href={preferredDownload.apkUrl} 
              download={preferredDownload.apkFileName}
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
            {installEvent && (
              <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                <button 
                  onClick={handleInstallPwa}
                  className={styles.secondaryButton}
                  style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '12px', fontSize: '15px' }}
                >
                  <MonitorPlay size={20} />
                  Install Dashboard Web App
                </button>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px', lineHeight: 1.4 }}>
                  Add this web app to your desktop or your device's home screen for easier access and faster loading.
                </p>
              </div>
            )}
          </div>
          
          {/* Toggle for Alternatives */}
          <div className={styles.toggleWrapper} style={{ marginTop: '1.5rem', textAlign: 'center', width: '100%' }}>
            <button
              onClick={() => setShowOptions(!showOptions)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              {showOptions ? 'Hide advanced options' : 'Need a different version?'}
              {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          <div className={`${styles.optionsWrapper} ${showOptions ? styles.optionsExpanded : ''}`}>
            <div className={styles.alternativeDownloads}>
              <div className={styles.alternativeHeader}>
                <p className={styles.alternativeTitle}>Other download alternatives</p>
                <p className={styles.alternativeDesc}>
                  The main link auto-selects the best APK for your device. If installation
                  fails, use these simple alternatives.
                </p>
              </div>
              <div className={styles.optionList}>
                {downloadOptions.map((option) => (
                  <a
                    key={option.key}
                    href={option.download.apkUrl}
                    download={option.download.apkFileName}
                    className={`${styles.optionLink} ${
                      option.isRecommended ? styles.optionLinkRecommended : ''
                    }`}
                  >
                    <span className={styles.optionText}>
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                    </span>
                    <span className={styles.optionMeta}>
                      {option.isRecommended && <em>Recommended</em>}
                      <small>{formatApkSize(option.download.sizeBytes)}</small>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle} style={{ alignSelf: 'flex-start' }}>Installation Guide</h2>

          <ul className={styles.infoList}>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><Download size={18} /></div>
              <div>
                <strong>1. Download the App</strong>
                <br />Scan the QR code or click the download link.
              </div>
            </li>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><ShieldCheck size={18} /></div>
              <div>
                <strong>2. Allow Unknown Sources</strong>
                <br />If prompted by your device, tap Settings and allow installation from this source.
              </div>
            </li>
            <li className={styles.infoListItem}>
              <div className={styles.infoListItemIcon}><Zap size={18} /></div>
              <div>
                <strong>3. Grant Permissions</strong>
                <br />Accept Camera (QR code scanner) and Location (geofencing) permissions to sign in.
              </div>
            </li>
          </ul>

          <div 
            className={styles.infoListItem} 
            style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              backgroundColor: 'rgba(255, 170, 0, 0.1)', 
              borderRadius: '8px',
              marginBottom: 0,
              textAlign: 'left'
            }}
          >
            <div className={styles.infoListItemIcon}><TriangleAlert size={18} color="#d97706" /></div>
            <div>
              <strong style={{ color: '#d97706' }}>Security Notice</strong>
              <br />Safety warnings are standard for enterprise applications outside the Play Store. This app is fully verified and secure.
            </div>
          </div>

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
                Internal enterprise application. Not available on public app stores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
