/** Eyebrow, h2, and lead paragraph used by every homepage section. */
export default function SectionHeading({ id, eyebrow, title, children, align = "left" }) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className="text-[13px] font-semibold text-brand-700">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">
        {title}
      </h2>
      {children && <p className="mt-3 text-base leading-7 text-slate-600">{children}</p>}
    </div>
  );
}
