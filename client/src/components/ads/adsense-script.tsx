import { useEffect } from "react";

interface AdSenseScriptProps {
  clientId?: string;
}

export function AdSenseScript({ clientId }: AdSenseScriptProps) {
  useEffect(() => {
    const adsenseClientId = clientId || import.meta.env.VITE_ADSENSE_CLIENT_ID;
    
    if (!adsenseClientId || adsenseClientId === "ca-pub-XXXXXXXXXX") {
      console.log("AdSense: No valid client ID configured");
      return;
    }

    if (document.querySelector('script[data-ad-client]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-ad-client", adsenseClientId);
    
    script.onerror = () => {
      console.log("AdSense: Script failed to load (may be blocked by ad blocker)");
    };

    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[data-ad-client]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [clientId]);

  return null;
}
