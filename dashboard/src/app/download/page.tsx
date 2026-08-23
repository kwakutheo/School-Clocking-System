'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  Download, 
  ShieldCheck, 
  Zap,
  Info,
  TriangleAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import styles from './page.module.css';
import {
  detectPreferredDownload,
  fallbackMobileAppManifest,
  fetchMobileAppManifest,
  formatApkSize,
  getFriendlyDownloadOptions,
  type ApkDownloadKey,
  type MobileAppManifest,
} from '@/lib/mobile-app-downloads';

export default function DownloadPage() {
  const [manifest, setManifest] = useState<MobileAppManifest>(
    fallbackMobileAppManifest,
  );
  const [preferredKey, setPreferredKey] =
    useState<ApkDownloadKey>('universal');
  const [showOptions, setShowOptions] = useState(false);

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

  const preferredDownload = manifest.downloads[preferredKey];
  const downloadOptions = getFriendlyDownloadOptions(manifest, preferredKey);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        
        {/* --- LEFT COLUMN: DOWNLOAD PANEL --- */}
        <section className={styles.downloadPanel}>
          <Image
            src="/app_logo.png"
            alt="TK Clocking Logo"
            width={120}
            height={120}
            className={styles.logo}
            priority
          />

          <h1 className={styles.title}>TK CLOCKING SYSTEM</h1>
          <p className={styles.subtitle}>
            Official Staff Mobile Application
          </p>

          <a
            href={preferredDownload.apkUrl}
            download={preferredDownload.apkFileName}
            className={styles.downloadButton}
          >
            <Download size={24} />
            Download APK ({formatApkSize(preferredDownload.sizeBytes)})
          </a>

          {/* Toggle for Alternatives */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              onClick={() => setShowOptions(!showOptions)}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
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

          {/* Hidden Alternatives Box */}
          <div className={`${styles.optionsWrapper} ${showOptions ? styles.optionsExpanded : ''}`}>
            <div className={styles.alternativeDownloads}>
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
                      <span style={{ fontSize: '0.85rem' }}>{option.description}</span>
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
        </section>

        <div className={styles.divider} />

        {/* --- RIGHT COLUMN: GUIDE PANEL --- */}
        <section className={styles.guidePanel}>
          <h2 className={styles.instructionsTitle}>Installation Guide</h2>
          <ul className={styles.instructionsList}>
            
            {/* Condensed Step 1 & 2 */}
            <li className={styles.instructionItem}>
              <div className={styles.iconWrapper}><Download size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>1. Download & Open</p>
                <p className={styles.instructionDesc}>Save the APK file to your device and tap to open it.</p>
              </div>
            </li>

            {/* Condensed Step 3 */}
            <li className={styles.instructionItem}>
              <div className={styles.iconWrapper}><ShieldCheck size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>2. Allow Unknown Sources</p>
                <p className={styles.instructionDesc}>If prompted by your device, tap Settings and allow installation from this source.</p>
              </div>
            </li>

            {/* Condensed Step 4 */}
            <li className={styles.instructionItem}>
              <div className={styles.iconWrapper}><Zap size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>3. Grant Permissions</p>
                <p className={styles.instructionDesc}>Accept Camera (QR code scanner) and Location (geofencing) permissions to sign in.</p>
              </div>
            </li>
          </ul>

          {/* Repurposed instructionItem to keep your styling for the security warning */}
          <div 
            className={styles.instructionItem} 
            style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              backgroundColor: 'rgba(255, 170, 0, 0.1)', 
              borderRadius: '8px' 
            }}
          >
            <div className={styles.iconWrapper}><TriangleAlert size={18} color="#d97706" /></div>
            <div className={styles.instructionText}>
              <p className={styles.instructionStep} style={{ color: '#d97706' }}>Security Notice</p>
              <p className={styles.instructionDesc}>
                Safety warnings are standard for enterprise applications outside the Play Store. This app is fully verified and secure.
              </p>
            </div>
          </div>

          <div className={styles.footerNote} style={{ marginTop: '1rem' }}>
            <Info size={16} />
            <span>Internal enterprise application. Not available on public app stores.</span>
          </div>
        </section>
      </div>
    </div>
  );
}