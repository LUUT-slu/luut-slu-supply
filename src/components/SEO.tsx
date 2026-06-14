import { Helmet } from "react-helmet-async";

const SITE_URL = "https://luut-slu-supply.lovable.app";

interface SEOProps {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
}

export function SEO({ title, description, path = "", image, type = "website", noindex }: SEOProps) {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
      {noindex && <meta name="robots" content="noindex" />}
    </Helmet>
  );
}
