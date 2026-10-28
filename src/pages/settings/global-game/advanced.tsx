import { useRouter } from "next/router";
import { useEffect } from "react";

// easy-launcher: settings became a single page — keep old links working.
const GlobalGameAdvancedSettingsRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: "/settings", query: { cat: "global-game" } });
  }, [router]);
  return null;
};

export default GlobalGameAdvancedSettingsRedirect;
