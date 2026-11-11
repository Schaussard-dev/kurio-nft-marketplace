import { TriangleAlert } from 'lucide-react'

interface ChangeNoticeProps {
  id?: string
  title: string
  items: string[]
}

/**
 * Inline banner for cart changes the collector must see before checkout (stock below the quantity now;
 * realtime price changes later). Icon + text, never colour alone; announced politely.
 */
export function ChangeNotice({ id, title, items }: ChangeNoticeProps) {
  return (
    <div id={id} role="status" className="flex gap-3 rounded-sm border border-primary/60 bg-primary/10 px-4 py-3 text-body-14 text-foreground">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-text-accent" />
      <div className="flex flex-col gap-1">
        <p className="font-bold">{title}</p>
        <ul className="flex flex-col gap-0.5 text-text-secondary">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
