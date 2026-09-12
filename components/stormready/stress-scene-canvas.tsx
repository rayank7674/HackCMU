"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import { SCENE_LEVEL_COLOR, type StressSceneModel, type StressSceneNode } from "@/lib/stress/scene";

function HouseholdHouse({ level }: { level: StressSceneModel["houseLevel"] }) {
  const roof = level === "none" || level === "constrained" ? "#1e4f86" : SCENE_LEVEL_COLOR[level];
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.55, 1.1, 1.28]} />
        <meshStandardMaterial color="#6f8aa6" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.32, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.22, 0.62, 4]} />
        <meshStandardMaterial color={roof} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.32, 0.66]}>
        <boxGeometry args={[0.3, 0.48, 0.08]} />
        <meshStandardMaterial color="#10233d" />
      </mesh>
      <mesh position={[0.38, 0.7, 0.65]}>
        <boxGeometry args={[0.26, 0.22, 0.05]} />
        <meshStandardMaterial color="#d7e4f4" />
      </mesh>
    </group>
  );
}

function DependencyOrb({ node }: { node: StressSceneNode }) {
  const ref = useRef<Mesh>(null);
  const radius = node.isFirstBreak ? 0.34 : node.failed ? 0.28 : node.inCascade ? 0.22 : 0.16;

  useFrame((state) => {
    if (!ref.current || !node.isFirstBreak) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.1) * 0.14;
    ref.current.scale.setScalar(pulse);
  });

  if (node.id === "home") return null;

  return (
    <group position={node.position}>
      <mesh position={[0, -node.position[1] / 2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, Math.max(node.position[1], 0.2), 8]} />
        <meshBasicMaterial color={node.color} />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color={node.color} />
      </mesh>
    </group>
  );
}

function SceneContents({ model }: { model: StressSceneModel }) {
  return (
    <>
      <color attach="background" args={["#b9cce0"]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[3.4, 5.2, 2.6]} intensity={0.85} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[4.8, 48]} />
        <meshStandardMaterial color="#c5d6e8" />
      </mesh>
      <HouseholdHouse level={model.houseLevel} />
      {model.edges.map((edge) => (
        <Line
          key={`${edge.from}-${edge.to}`}
          points={[edge.fromPos, edge.toPos]}
          color={edge.inCascade ? "#b42318" : "#7f93a8"}
          lineWidth={edge.inCascade ? 4 : 1.5}
          transparent
          opacity={edge.inCascade ? 0.95 : 0.45}
        />
      ))}
      {model.nodes.map((node) => (
        <DependencyOrb key={node.id} node={node} />
      ))}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minDistance={3.8}
        maxDistance={8}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 2.25}
        target={[0, 0.6, 0]}
      />
    </>
  );
}

export function StressSceneCanvas({ model }: { model: StressSceneModel }) {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [3.8, 2.15, 4.9], fov: 42, near: 0.1, far: 40 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "default" }}
      aria-label="Modeled 3D household dependencies under this simulated scenario"
    >
      <SceneContents model={model} />
    </Canvas>
  );
}
