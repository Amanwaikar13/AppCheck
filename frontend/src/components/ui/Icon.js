// Inline icon set (24px grid, 1.75 stroke) so the app needs no icon library.
// Decorative by default (aria-hidden); pair icon-only controls with aria-label.
const PATHS = {
  overview: "M3.75 13.5h6.75V3.75H3.75v9.75Zm0 6.75h6.75v-4.5H3.75v4.5Zm9.75 0h6.75V10.5H13.5v9.75Zm0-16.5v4.5h6.75v-4.5H13.5Z",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.4 3.75-5.4 3.75-9S14.5 5.4 12 3m0 18c-2.5-2.4-3.75-5.4-3.75-9S9.5 5.4 12 3M3.5 9h17M3.5 15h17",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4m-2.5-11-3 14",
  history: "M3 12a9 9 0 1 0 2.64-6.36L3 8.25M3 3v5.25h5.25M12 7.5V12l3 2",
  alert:
    "M12 9v4m0 3.5h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  bug: "M12 20.25a6 6 0 0 0 6-6v-3a6 6 0 0 0-12 0v3a6 6 0 0 0 6 6Zm0 0V12m-6 1.5H3m18 0h-3M6.6 7.5 4.5 5.25M17.4 7.5l2.1-2.25M6 17.25l-2.25 2.25M18 17.25l2.25 2.25M9 6.75V5.25a3 3 0 0 1 6 0v1.5",
  report: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6m-6 4h4",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3c0-.5 0-1-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4L14 2.6h-4l-.5 2.6A7 7 0 0 0 7.1 6.6l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.8l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.5 2.6h4l.5-2.6a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.4Z",
  shield: "M12 3 4.5 6v5.6c0 4.4 3.1 8.2 7.5 9.4 4.4-1.2 7.5-5 7.5-9.4V6L12 3Zm-3 9 2 2 4-4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  refresh: "M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.5H14M5.5 21v-4.5H10",
  chevronUp: "m7 14 5-5 5 5",
  chevronDown: "m7 10 5 5 5-5",
  chevronLeft: "m14 7-5 5 5 5",
  chevronRight: "m10 7 5 5-5 5",
  sort: "m8 9 4-4 4 4m-8 6 4 4 4-4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-4.5m0-3h.01",
  check: "m5 12.5 4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3.75-9 2.5 2.5 5-5",
  x: "M7 7l10 10M17 7 7 17",
  xCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12 6 6m0-6-6 6",
  play: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-1.5-12.5 5 3.5-5 3.5v-7Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  arrowLeft: "M19 12H5m5-5-5 5 5 5",
  plus: "M12 5v14M5 12h14",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  database:
    "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Zm8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6m16 6c0 1.7-3.6 3-8 3s-8-1.3-8-3",
  server: "M4 4h16v6H4V4Zm0 10h16v6H4v-6Zm3-7h.01M7 17h.01",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13V11Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2",
  queue: "M4 6h16M4 12h10M4 18h6",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5",
};

export default function Icon({ name, className = "size-5", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
