import styles from './Brand.module.css';

export function Brand() {
  return <span className={styles.brand}>
    <span className={styles.mark} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
        <path d="M12 20C12 13 18 6 27 5c-1 9-8 15-15 15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m13 12-6 1-3 6 8 1 1 8 6-3 1-6M10 23l-4 3m2-5-3 1m6 3-1 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
    <span><span className={styles.ai}>AI</span>mpulsa<span className={styles.dot} aria-hidden="true">.</span></span>
  </span>;
}
