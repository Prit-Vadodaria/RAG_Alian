import { useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "../services/http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const defaultClient = createApiClient(SERVER_BASE);

const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function useAdminConfig(section, options = {}) {
  const client = options.client || defaultClient;
  const [fullConfig, setFullConfig] = useState(null);
  const [sectionConfig, setSectionConfigState] = useState(null);
  const [baselineConfig, setBaselineConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fullConfigRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");

    client
      .get("/admin/config")
      .then((response) => {
        if (!active) return;
        const nextConfig = response.data?.data || response.data || {};
        fullConfigRef.current = nextConfig;
        setFullConfig(nextConfig);
        const nextSection = nextConfig?.[section] || {};
        setSectionConfigState(nextSection);
        setBaselineConfig(nextSection);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client, section]);

  const isDirty = useMemo(
    () => !deepEqual(sectionConfig, baselineConfig),
    [sectionConfig, baselineConfig],
  );

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty || saving || loading) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, loading, saving]);

  const setSectionConfig = (patch) => {
    setSectionConfigState((current) => {
      const resolvedPatch = typeof patch === "function" ? patch(current || {}) : patch;
      return {
        ...(current || {}),
        ...(resolvedPatch || {}),
      };
    });
  };

  const save = async () => {
    if (!fullConfigRef.current) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const nextFullConfig = {
        ...fullConfigRef.current,
        [section]: sectionConfig,
      };
      const response = await client.put("/admin/config", nextFullConfig);
      const savedConfig = response.data?.data || response.data || nextFullConfig;
      fullConfigRef.current = savedConfig;
      setFullConfig(savedConfig);
      const nextSection = savedConfig?.[section] || {};
      setSectionConfigState(nextSection);
      setBaselineConfig(nextSection);
      setNotice("Saved and applied immediately.");
      window.dispatchEvent(new Event("rag-config-updated"));
      return savedConfig;
    } catch (err) {
      setError(err.message || String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    fullConfig,
    sectionConfig,
    setSectionConfig,
    save,
    saving,
    loading,
    error,
    notice,
    isDirty,
    setError,
    setNotice,
  };
}

export default useAdminConfig;
