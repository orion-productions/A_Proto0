import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box } from 'lucide-react';

function RotatingCube() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.7;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4f46e5" />
    </mesh>
  );
}

function ThreeDWindow() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <Box size={18} />
        3D Window
      </div>
      
      <div className="flex-1 bg-gray-900">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={1} 
            target-position={[0, 0, 0]}
            castShadow
          />
          <RotatingCube />
          <OrbitControls />
        </Canvas>
      </div>
    </div>
  );
}

export default ThreeDWindow;

