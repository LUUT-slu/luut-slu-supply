import { useParams, Link, Navigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ChatButton } from '@/components/ChatButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SEO } from '@/components/SEO';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { Loader2 } from 'lucide-react';

export default function CategoryMain() {
  const { main: mainSlug } = useParams<{ main: string }>();
  const { taxonomy, loading } = useTaxonomy();

  const main = taxonomy?.mains.find((m) => m.slug === mainSlug);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!main) return <Navigate to="/shop" replace />;

  const path = `/c/${main.slug}`;
  const title = `${main.title} — Luut SLU`.slice(0, 60);
  const desc = (main.description || `Browse ${main.title.toLowerCase()} from local sellers in Saint Lucia.`).slice(0, 160);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO
        title={title}
        description={desc}
        path={path}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: main.title,
          description: desc,
          url: `https://luut-slu-supply.lovable.app${path}`,
          isPartOf: { "@type": "WebSite", name: "Luut SLU", url: "https://luut-slu-supply.lovable.app/" },
        }}
      />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-8 md:py-12">
          <div className="container">
            <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: main.title }]} />
            <h1 className="font-display text-3xl md:text-5xl">{main.title}</h1>
            {main.description && (
              <p className="mt-2 max-w-2xl font-body text-muted-foreground">{main.description}</p>
            )}
          </div>
        </section>

        <section className="px-4 py-8 md:py-12">
          <div className="container">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 sm:gap-4">
              {main.subs.map((sub) => (
                <Link
                  key={sub.handle}
                  to={sub.url}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-border/50 transition hover:ring-primary"
                >
                  {sub.image ? (
                    <img
                      src={sub.image}
                      alt={sub.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/40">
                      <span className="font-display text-2xl text-muted-foreground/50">
                        {sub.title.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="inline-block rounded-full bg-background/90 px-3 py-1.5 font-display text-xs tracking-wide text-foreground backdrop-blur-sm md:text-sm">
                      {sub.title}
                    </span>
                    <p className="mt-1 text-xs text-white/80">{sub.productCount} item{sub.productCount === 1 ? '' : 's'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
