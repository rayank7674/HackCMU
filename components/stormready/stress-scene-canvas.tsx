"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import { SCENE_LEVEL_COLOR, type StressSceneModel, type StressSceneNode } from "@/lib/stress/scene";

function HouseholdHouse({ level }: { level: StressSceneModel["houseLevel"] }) {
  const roof = level === "none" || level === "constrained" ? "#1e4f86" : SCENE_LEVEL_COLOR[level];
  return (
    <group>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[1.35, 0.92, 1.15]} />
        <meshStandardMaterial color="#8fa6be" />
      </mesh>
      <mesh position={[0, 1.12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.08, 0.52, 4]} />
        <meshStandardMaterial color={roof} />
      </mesh>
      <mesh position={[0, 0.28, 0.59]}>
        <boxGeometry args={[0.26, 0.42, 0.06]} />
        <meshStandardMaterial color="#163a62" />
      </mesh>
      <mesh position={[0.32, 0.58, 0.58]}>
        <boxGeometry args={[0.22, 0.18, 0.04]} />
        <meshStandardMaterial color="#d7e4f4" />
      </mesh>
    </group>
  );
}

function DependencyOrb({ node }: { node: StressSceneNode }) {
  const ref = useRef<Mesh>(null);
  const radius = node.isFirstBreak ? 0.28 : node.failed ? 0.24 : 0.18;
  const base = 1;

  useFrame((state) => {
    if (!ref.current) return;
    if (!node.isFirstBreak) {
      ref.current.scale.setScalar(base);
      return;
    }
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.1) * 0.12;
    ref.current.scale.setScalar(base * pulse);
  });

  if (node.id === "home") return null;

  return (
    <group position={node.position}>
      <mesh position={[0, -node.position[1] / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, Math.max(node.position[1], 0.2), 8]} />
        <meshStandardMaterial color={node.failed ? node.color : "#b7c4d3"} />
      </mesh>
      <mesh ref={ref} castShadow>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.failed ? node.color : "#000000"}
          emissiveIntensity={node.failed ? 0.55 : 0}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      <Html
        position={[0, -(radius + 0.22), 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none", userSelect: "none" }}
        zIndexRange={[1, 0]}
      >
        <div className={`sr-stress-label${node.failed ? " is-failed" : ""}`}>
          {node.shortLabel}
        </div>
      </Html>
    </group>
  );
}

function SceneContents({ model }: { model: StressSceneModel }) {
  return (
    <>
      <color attach="background" args={["#c9d8ea"]} />
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[4.2, 6.4, 3.2]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.1, 48]} />
        <meshStandardMaterial color="#d5e1ee" />
      </mesh>
      <HouseholdHouse level={model.houseLevel} />
      {model.edges.map((edge) => (
        <Line
          key={`${edge.from}-${edge.to}`}
          points={[edge.fromPos, edge.toPos]}
          color={edge.inCascade ? "#b42318" : "#8ea0b4"}
          lineWidth={edge.inCascade ? 3.4 : 1.4}
          transparent
          opacity={edge.inCascade ? 0.95 : 0.55}
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
      camera={{ position: [4.4, 2.7, 5.4], fov: 40, near: 0.1, far: 40 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: false, powerPreference: "default" }}
      aria-label="Modeled 3D household dependencies under this simulated scenario"
    >
      <SceneContents model={model} />
    </Canvas>
  );
}
