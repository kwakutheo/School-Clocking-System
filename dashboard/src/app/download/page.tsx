'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  Zap,
  Info,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
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
  const [showAlternatives, setShowAlternatives] = useState(false);

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
        {/* Main Hero Header */}
        <section className={styles.heroSection}>
          <Image
            src="/app_logo.png"
            alt="TK Clocking Logo"
            width={100}
            height={100}
            className={styles.logo}
            priority
          />
          <h1 className={styles.title}>TK CLOCKING SYSTEM</h1>
          <p className={styles.subtitle}>Official Staff Mobile Application</p>

          <a
            href={preferredDownload.apkUrl}
            download={preferredDownload.apkFileName}
            className={styles.primaryDownloadButton}
          >
            <Download size={22} />
            <span>Download for Your Device</span>
            <small>({formatApkSize(preferredDownload.sizeBytes)})</small>
          </a>

          {/* Collapsible Architecture Alternatives */}
          <div className={styles.alternativesContainer}>
            <button
              type="button"
              className={styles.toggleAlternativesBtn}
              onClick={() => setShowAlternatives((prev) => !prev)}
            >
              <span>Need a specific device version?</span>
              {showAlternatives ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showAlternatives && (
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
                    <div className={styles.optionText}>
                      <strong>{option.title}</strong>
                      <span>{option.description}</span>
                    </div>
                    <div className={styles.optionMeta}>
                      {option.isRecommended && <em>Recommended</em>}
                      <small>{formatApkSize(option.download.sizeBytes)}</small>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Installation Instructions */}
        <section className={styles.guidePanel}>
          <h2 className={styles.instructionsTitle}>Installation Guide</h2>

          <div className={styles.instructionsGrid}>
            <div className={styles.instructionItem}>
              <div className={styles.iconWrapper}><Download size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>1. Download APK</p>
                <p className={styles.instructionDesc}>Tap the download button above to save the package file.</p>
              </div>
            </div>

            <div className={styles.instructionItem}>
              <div className={styles.iconWrapper}><ShieldCheck size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>2. Allow Installation</p>
                <p className={styles.instructionDesc}>Enable "Install from Unknown Sources" if your browser requests permission.</p>
              </div>
            </div>

            <div className={styles.instructionItem}>
              <div className={styles.iconWrapper}><CheckCircle2 size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>3. Install & Open</p>
                <p className={styles.instructionDesc}>Complete the setup prompts and launch the app to sign in.</p>
              </div>
            </div>

            <div className={styles.instructionItem}>
              <div className={styles.iconWrapper}><Zap size={18} /></div>
              <div className={styles.instructionText}>
                <p className={styles.instructionStep}>4. Grant Permissions</p>
                <p className={styles.instructionDesc}>Allow Camera (QR code scanner) and Location (geofencing) access when prompted.</p>
              </div>
            </div>
          </div>

          {/* Enterprise Safety Banner */}
          <div className={styles.securityCallout}>
            <TriangleAlert size={20} className={styles.warningIcon} />
            <div>
              <strong>Security Protocol Notice</strong>
              <p>
                Standard safety warnings during APK installations outside the Play Store are normal. 
                This internal enterprise app is verified and safe for installation.
              </p>
            </div>
          </div>

          <div className={styles.footerNote}>
            <Info size={16} />
            <span>Internal enterprise application. Not available on public app stores.</span>
          </div>
        </section>
      </div>
    </div>
  );
}