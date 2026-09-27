import { useEffect, useState } from "react";
import { publicApi } from "../api/publicLocale";
import { mediaUrl } from "../api/client";

interface Branding {
  company_name: string;
  logo_url: string | null;
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    publicApi.getBranding().then(setBranding).catch(() => setBranding(null));
  }, []);

  return branding;
}

export function BrandLogo({
  size = 64,
  textClassName = "",
}: {
  size?: number;
  textClassName?: string;
}) {
  const branding = useBranding();

  if (branding?.logo_url) {
    return (
      <img
        src={mediaUrl(branding.logo_url)}
        alt={branding.company_name}
        style={{ height: size }}
        className="object-contain w-auto"
      />
    );
  }

  // Falls back to the text wordmark until branding loads, or permanently
  // if no logo has been uploaded yet.
  return <span className={textClassName}>{branding?.company_name ?? "Cake Studio"}</span>;
}
