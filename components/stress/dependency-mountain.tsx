"use client";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { StressResult } from "@/lib/stress";

const LAYER_IDS = [
  "power",
  "water",
  "road",
  "transport",
  "mobility",
  "communication",
  "food",
  "healthcare",
  "shelter",
] as const;

const LEVEL_COLOR: Record<string, string> = {
  none: "#2c6aa8",
  constrained: "#d97706",
  major: "#b42318",
  critical: "#7f1d1d",
};

/**
 * Abstract stacked layers for a modeled household graph.
 * Not a city map and not official GIS.
 */
export function DependencyMountain({ result }: { result: StressResult }) {
  const cascade = new Set(result.cascadePath);
  const layers = LAYER_IDS.map((id) => result.nodes.find((node) => node.id === id)).filter(
    (node): node is NonNullable<typeof node> => Boolean(node),
  );
  const count = Math.max(layers.length, 1);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface-elevated">
      <p className="px-3 pt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        Modeled layers — not official GIS
      </p>
      <div className="h-[260px]">
        <Canvas
          camera={{ position: [7.2, 5.4, 8.4], fov: 40 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#e8eef6"]} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[6, 10, 4]} intensity={1.15} />
          <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.05} />
          <group position={[0, -1.6, 0]}>
            {layers.map((node, index) => {
              const t = index / count;
              const width = 3.4 - t * 2.1;
              const highlighted = cascade.has(node.id);
              return (
                <group key={node.id} position={[0, index * 0.42, 0]}>
                  <mesh>
                    <boxGeometry args={[width, 0.32, width]} />
                    <meshStandardMaterial
                      color={LEVEL_COLOR[node.level] ?? "#2c6aa8"}
                      emissive={highlighted ? "#f8fafc" : "#000000"}
                      emissiveIntensity={highlighted ? 0.18 : 0}
                    />
                  </mesh>
                  <Html position={[width / 2 + 0.35, 0, 0]} center>
                    <p className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
                      {node.label}
                      {highlighted ? " · cascade" : ""}
                    </p>
                  </Html>
                </group>
              );
            })}
          </group>
        </Canvas>
      </div>
    </div>
  );
}
