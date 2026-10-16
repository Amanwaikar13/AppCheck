import Header from "./Header";
import Sidebar from "./Sidebar";

/** Application frame: fixed navy sidebar on desktop, header with drawer below lg. */
export default function AppShell({ children }) {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside aria-label="Sidebar" className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-60">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-7"
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
