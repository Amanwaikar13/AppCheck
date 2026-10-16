import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

/** Lists what a feature checks or will do, with a badge saying which (e.g. Planned, Passive). */
export default function PlannedChecks({ title = "What scanning will check", badge = "Planned", icon, items, footer }) {
  return (
    <Card title={title} meta={<Badge variant="outline">{badge}</Badge>}>
      <ul className="space-y-4">
        {items.map(({ title: itemTitle, body }) => (
          <li key={itemTitle} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
              <Icon name={icon} className="size-3.5" />
            </span>
            <div className="text-[13px] leading-5">
              <p className="font-medium text-slate-900">{itemTitle}</p>
              <p className="mt-0.5 text-slate-600">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      {footer && (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{footer}</p>
      )}
    </Card>
  );
}
