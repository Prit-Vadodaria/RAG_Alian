import { useEffect, useRef } from "react";

function DarkVeil({
  hueShift = 0,
  noiseIntensity = 0,
  scanlineIntensity = 0.08,
  speed = 0.9,
  scanlineFrequency = 0.5,
  warpAmount = 0.08,
}) {
  const veilRef = useRef(null);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 1;
      const el = veilRef.current;
      if (!el) return;
      const t = frame * speed * 0.012;
      el.style.setProperty("--veil-x", `${Math.sin(t) * 8 * warpAmount}px`);
      el.style.setProperty("--veil-y", `${Math.cos(t * 0.9) * 10 * warpAmount}px`);
      el.style.setProperty("--veil-angle", `${hueShift}deg`);
      el.style.setProperty("--veil-noise", `${noiseIntensity}`);
      el.style.setProperty("--veil-scanlines", `${scanlineIntensity}`);
      el.style.setProperty("--veil-scan-freq", `${scanlineFrequency}`);
      requestAnimationFrame(animate);
    };

    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [hueShift, noiseIntensity, scanlineIntensity, speed, scanlineFrequency, warpAmount]);

  return (
    <div ref={veilRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="dark-veil-layer" />
      <div className="dark-veil-orb dark-veil-orb-a" />
      <div className="dark-veil-orb dark-veil-orb-b" />
      <div className="dark-veil-orb dark-veil-orb-c" />
      <div className="dark-veil-scanlines" />
      <div className="dark-veil-noise" />
    </div>
  );
}

export default DarkVeil;
