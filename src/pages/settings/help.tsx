import { useRouter } from "next/router";
import { useEffect } from "react";

// easy-launcher: help content now lives inside the About tab of /settings.
const HelpSettingsRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: "/settings", query: { cat: "about" } });
  }, [router]);
  return null;
};

export default HelpSettingsRedirect;
