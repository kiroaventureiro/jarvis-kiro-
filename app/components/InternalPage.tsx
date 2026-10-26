import Link from "next/link";
import JarvisNavigation from "./JarvisNavigation";
export default function InternalPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <main className="internal-page">
      <header className="internal-header">
        <Link className="wordmark" href="/">
          JARVIS <span>KIRO</span>
        </Link>
        <JarvisNavigation />
      </header>
      <div className="internal-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
