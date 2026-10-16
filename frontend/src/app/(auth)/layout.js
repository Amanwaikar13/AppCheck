import Brand from "@/components/layout/Brand";
import Icon from "@/components/ui/Icon";

const POINTS = [
  { icon: "globe", text: "Record URL and source code scan requests for applications you are authorized to test." },
  { icon: "history", text: "Track every request in a private, per-account scan history." },
  { icon: "lock", text: "HttpOnly session cookies, CSRF protection, and server-side authorization on every request." },
];

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-navy-950 p-10 text-navy-200 lg:flex">
        <Brand subtitle />
        <div className="max-w-md">
          <p className="text-2xl font-semibold tracking-tight text-white">
            Web application security and code quality, in one workspace.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon, text }) => (
              <li key={icon} className="flex gap-3 text-sm leading-6">
                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 text-brand-300">
                  <Icon name={icon} className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-navy-400">Scan only applications and code you own or are explicitly authorized to test.</p>
      </aside>

      <div className="flex flex-col bg-canvas">
        <header className="px-4 pt-8 lg:hidden">
          <div className="mx-auto w-fit">
            <Brand tone="light" />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-slate-500 lg:hidden">
          Scan only applications and code you are authorized to test.
        </footer>
      </div>
    </div>
  );
}
