import { useRouter } from "next/router";
import { useEffect } from "react";

// easy-launcher: settings became a single page — keep old links working.
const AboutSettingsRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: "/settings", query: { cat: "about" } });
  }, [router]);
  return null;
};

export default AboutSettingsRedirect;
