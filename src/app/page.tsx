"use client";

import { useEffect } from "react";
import "./portal.css";
import { PORTAL_HTML } from "./portal-markup";
import { initPortal } from "./portal-client";

export default function Home() {
  useEffect(() => {
    const cleanup = initPortal();
    return cleanup;
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: PORTAL_HTML }} />;
}
