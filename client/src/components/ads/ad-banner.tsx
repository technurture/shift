import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

interface AdBannerProps {
  slot?: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
  userPlan?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const DEFAULT_AD_SLOT = import.meta.env.VITE_ADSENSE_SLOT_ID || "1425792533";

export function AdBanner({ slot = DEFAULT_AD_SLOT, format = "auto", className = "", userPlan }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    if (userPlan && userPlan !== "free") return;
    
    if (adRef.current && !isAdLoaded.current) {
      try {
        const adsbygoogle = window.adsbygoogle || [];
        adsbygoogle.push({});
        isAdLoaded.current = true;
      } catch (error) {
        console.log("AdSense not loaded");
      }
    }
  }, [userPlan]);

  if (userPlan && userPlan !== "free") {
    return null;
  }

  const getAdStyle = () => {
    switch (format) {
      case "rectangle":
        return { display: "inline-block", width: "300px", height: "250px" };
      case "horizontal":
        return { display: "inline-block", width: "728px", height: "90px" };
      case "vertical":
        return { display: "inline-block", width: "160px", height: "600px" };
      default:
        return { display: "block" };
    }
  };

  return (
    <div className={`ad-container ${className}`} data-testid="ad-banner">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={getAdStyle()}
        data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT_ID || "ca-pub-XXXXXXXXXX"}
        data-ad-slot={slot}
        data-ad-format={format === "auto" ? "auto" : undefined}
        data-full-width-responsive={format === "auto" ? "true" : undefined}
      />
    </div>
  );
}

interface AdPlaceholderProps {
  type: "sidebar" | "banner" | "inline";
  className?: string;
  userPlan?: string;
  onUpgrade?: () => void;
}

export function AdPlaceholder({ type, className = "", userPlan, onUpgrade }: AdPlaceholderProps) {
  if (userPlan && userPlan !== "free") {
    return null;
  }

  const getStyles = () => {
    switch (type) {
      case "sidebar":
        return "w-full h-[250px]";
      case "banner":
        return "w-full h-[90px]";
      case "inline":
        return "w-full h-[100px]";
      default:
        return "w-full h-[100px]";
    }
  };

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br from-muted/50 to-muted border-dashed ${getStyles()} ${className}`}
      data-testid={`ad-placeholder-${type}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <div className="text-xs text-muted-foreground mb-2">Advertisement</div>
        <div className="text-sm text-muted-foreground/80 mb-3">
          Upgrade to remove ads
        </div>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="text-xs text-primary hover:underline font-medium"
            data-testid="button-upgrade-remove-ads"
          >
            Go Premium
          </button>
        )}
      </div>
    </Card>
  );
}

interface SponsoredContentProps {
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl?: string;
  userPlan?: string;
  className?: string;
}

export function SponsoredContent({ 
  title, 
  description, 
  ctaText, 
  ctaUrl, 
  imageUrl,
  userPlan,
  className = "" 
}: SponsoredContentProps) {
  if (userPlan && userPlan !== "free") {
    return null;
  }

  return (
    <Card className={`p-4 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 ${className}`} data-testid="sponsored-content">
      <div className="flex items-start gap-4">
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={title}
            className="w-16 h-16 rounded-md object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Sponsored
            </span>
          </div>
          <h4 className="font-medium text-sm truncate">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{description}</p>
          <a 
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="text-xs text-primary hover:underline font-medium"
            data-testid="link-sponsored-cta"
          >
            {ctaText}
          </a>
        </div>
      </div>
    </Card>
  );
}
