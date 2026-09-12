"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import { SCENE_LEVEL_COLOR, type StressSceneModel, type StressSceneNode } from "@/lib/stress/scene";

function HouseholdHouse({ level }: { level: StressSceneModel["houseLevel"] }) {
  const accent = SCENE_LEVEL_COLOR[level];
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[1.15, 0.84, 0.98]} />
        <meshStandardMaterial color="#e8eef6" />
      </mesh>
      <mesh position={[0, 1.02, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.92, 0.42, 4]} />
        <meshStandardMaterial color={level === "none" ? "#1e4f86" : accent} />
      </mesh>
      <mesh position={[0, 0.26, 0.5]}>
        <boxGeometry args={[0.22, 0.38, 0.05]} />
        <meshStandardMaterial color="#1e4f86" />
      </mesh>
    </group>
  );
}

function DependencyOrb({ node }: { node: StressSceneNode }) {
  const ref = useRef<Mesh>(null);
  const base = node.isFirstBreak ? 1.22 : node.inCascade ? 1.08 : 1;

  useFrame((state) => {
    if (!ref.current) return;
    if (!node.isFirstBreak) {
      ref.current.scale.setScalar(base);
      return;
    }
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.1) * 0.1;
    ref.current.scale.setScalar(base * pulse);
  });

  if (node.id === "home") return null;

  return (
    <group position={node.position}>
      <mesh ref={ref} castShadow>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.failed ? node.color : "#000000"}
          emissiveIntensity={node.failed ? 0.32 : 0}
        />
      </mesh>
      <Html
        center
        distanceFactor={7.5}
        style={{ pointerEvents: "none", userSelect: "none" }}
        zIndexRange={[1, 0]}
      >
        <div className="sr-stress-label">{node.shortLabel}</div>
      </Html>
    </group>
  );
}

function SceneContents({ model }: { model: StressSceneModel }) {
  return (
    <>
      <color attach="background" args={["#dce7f3"]} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[4.2, 6.4, 3.2]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.1, 48]} />
        <meshStandardMaterial color="#eef3f8" />
      </mesh>
      <HouseholdHouse level={model.houseLevel} />
      {model.edges.map((edge) => (
        <Line
          key={`${edge.from}-${edge.to}`}
          points={[edge.fromPos, edge.toPos]}
          color={edge.inCascade ? "#1e4f86" : "#b7c4d3"}
          lineWidth={edge.inCascade ? 2.4 : 1.2}
          transparent
          opacity={edge.inCascade ? 0.95 : 0.7}
        />
      ))}
      {model.nodes.map((node) => (
        <DependencyOrb key={node.id} node={node} />
      ))}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minDistance={4.2}
        maxDistance={11}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.55, 0]}
      />
    </>
  );
}

export function StressSceneCanvas({ model }: { model: StressSceneModel }) {
  return (
    <Canvas
      camera={{ position: [5.1, 4.2, 6.1], fov: 42, near: 0.1, far: 40 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: false, powerPreference: "default" }}
      aria-label="Modeled 3D household dependencies under this simulated scenario"
    >
      <SceneContents model={model} />
    </Canvas>
  );
}
