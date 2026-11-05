import { useEffect, useState } from "react";

export function useHashRoute<T extends string>(routes: readonly T[], fallback: T): T {
  const read = () => {
    const hash = window.location.hash.replace(/^#\/?/, "") as T;
    return routes.includes(hash) ? hash : fallback;
  };
  const [route, setRoute] = useState<T>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  });
  return route;
}
