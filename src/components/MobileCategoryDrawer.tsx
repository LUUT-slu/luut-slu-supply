import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTaxonomy } from '@/hooks/useTaxonomy';

interface MobileCategoryDrawerProps {
  onNavigate?: () => void;
}

/**
 * Mobile category accordion. Loads marketplace taxonomy lazily — only when
 * the parent drawer mounts this component (the drawer is rendered inside a
 * Sheet that's only opened on demand).
 */
export function MobileCategoryDrawer({ onNavigate }: MobileCategoryDrawerProps) {
  const { mains, loading } = useTaxonomy();

  if (loading) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">Loading categories…</p>;
  }
  if (mains.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      {mains.map((main) => (
        <AccordionItem key={main.slug} value={main.slug}>
          <AccordionTrigger className="py-3 font-body text-base font-medium hover:no-underline">
            {main.title}
            <span className="ml-2 text-xs text-muted-foreground">({main.productCount})</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-1 pl-3">
              <Link
                to={main.url}
                onClick={onNavigate}
                className="py-1.5 text-sm font-medium text-primary"
              >
                View all {main.title}
              </Link>
              {main.subs.map((sub) => (
                <Link
                  key={sub.handle}
                  to={sub.url}
                  onClick={onNavigate}
                  className="flex items-center justify-between py-1.5 text-sm text-foreground/80 transition-colors hover:text-primary"
                >
                  <span>{sub.title}</span>
                  <span className="text-xs text-muted-foreground">{sub.productCount}</span>
                </Link>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
