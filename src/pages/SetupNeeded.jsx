import { Logo } from '../components/ui';

/** Shown while .env has no Firebase config yet. */
export default function SetupNeeded() {
  return (
    <div className="setup-banner">
      <Logo size={52} />
      <h2 style={{ fontSize: 24, margin: '16px 0 8px' }}>Connect Firebase</h2>
      <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
        The app is ready but no Firebase project is connected yet.
      </p>
      <ol style={{ lineHeight: 1.8, paddingLeft: 20, opacity: 0.9 }}>
        <li>
          Copy <code>.env.example</code> to <code>.env</code>
        </li>
        <li>Paste your Firebase web app config values into it</li>
        <li>
          Restart <code>pnpm dev</code>
        </li>
      </ol>
      <p style={{ opacity: 0.7, fontSize: 14 }}>Full steps are in README.md.</p>
    </div>
  );
}
