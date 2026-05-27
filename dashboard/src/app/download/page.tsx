import Image from 'next/image';
import { 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  Zap,
  Info
} from 'lucide-react';
import styles from './page.module.css';

export default function DownloadPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
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
          Official Employee Mobile Application
        </p>

        <a 
          href="/apps/tk_clocking.apk" 
          download="tk_clocking_app.apk"
          className={styles.downloadButton}
        >
          <Download size={24} />
          Download APK
        </a>

        <div className={styles.divider} />

        <h2 className={styles.instructionsTitle}>Installation Guide</h2>
        <ul className={styles.instructionsList}>
          <li className={styles.instructionItem}>
            <div className={styles.iconWrapper}><Download size={18} /></div>
            <div className={styles.instructionText}>
              <p className={styles.instructionStep}>1. Download the App</p>
              <p className={styles.instructionDesc}>Click the download button above. The APK file will be saved to your device.</p>
            </div>
          </li>
          
          <li className={styles.instructionItem}>
            <div className={styles.iconWrapper}><ShieldCheck size={18} /></div>
            <div className={styles.instructionText}>
              <p className={styles.instructionStep}>2. Allow Unknown Sources</p>
              <p className={styles.instructionDesc}>When opening the file, your device may prompt you to allow installations from unknown sources in Settings.</p>
            </div>
          </li>

          <li className={styles.instructionItem}>
            <div className={styles.iconWrapper}><CheckCircle2 size={18} /></div>
            <div className={styles.instructionText}>
              <p className={styles.instructionStep}>3. Install & Open</p>
              <p className={styles.instructionDesc}>Follow the prompts to install. Once done, open the app and log in with your credentials.</p>
            </div>
          </li>

          <li className={styles.instructionItem}>
            <div className={styles.iconWrapper}><Zap size={18} /></div>
            <div className={styles.instructionText}>
              <p className={styles.instructionStep}>4. Grant Permissions</p>
              <p className={styles.instructionDesc}>The app requires Camera (to scan branch QR code) and Location (for geofencing) permissions to function correctly.</p>
            </div>
          </li>
        </ul>

        <div className={styles.footerNote}>
          <Info size={16} color="var(--primary)" />
          <span>This is an internal enterprise application and is not available on public app stores.</span>
        </div>
      </div>
    </div>
  );
}
