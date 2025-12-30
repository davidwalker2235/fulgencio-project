'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
// Inspector comentado para evitar crear un canvas adicional
// import { Inspector } from 'three/addons/inspector/Inspector.js';
import './styles.css';

interface FaceMorphTargetsProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function FaceMorphTargets({ className, style }: FaceMorphTargetsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGPURenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    const init = async () => {
      if (!containerRef.current) return;

      const clock = new THREE.Clock();
      clockRef.current = clock;

      const camera = new THREE.PerspectiveCamera(
        45,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        1,
        20
      );
      camera.position.set(-1.8, 0.8, 3);
      cameraRef.current = camera;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const renderer = new THREE.WebGPURenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Inspector comentado para evitar crear un canvas adicional
      // renderer.inspector = new Inspector();
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      await renderer.init();

      if (!isMounted) {
        renderer.dispose();
        return;
      }

      const environment = new RoomEnvironment();
      const pmremGenerator = new THREE.PMREMGenerator(renderer);

      scene.background = new THREE.Color(0x666666);
      scene.environment = pmremGenerator.fromScene(environment).texture;

      const ktx2Loader = await new KTX2Loader()
        .setTranscoderPath('/jsm/libs/basis/')
        .detectSupport(renderer);

      new GLTFLoader()
        .setKTX2Loader(ktx2Loader)
        .setMeshoptDecoder(MeshoptDecoder)
        .load('/models/gltf/facecap.glb', (gltf) => {
          if (!isMounted) return;

          const mesh = gltf.scene.children[0];
          scene.add(mesh);

          const mixer = new THREE.AnimationMixer(mesh);
          mixerRef.current = mixer;

          if (gltf.animations.length > 0) {
            mixer.clipAction(gltf.animations[0]).play();
          }

          // GUI comentada ya que el Inspector está deshabilitado
          // const head = mesh.getObjectByName('mesh_2');
          // if (head && head.morphTargetInfluences) {
          //   const influences = head.morphTargetInfluences;
          //   const gui = renderer.inspector.createParameters('Morph Targets');

          //   if (head.morphTargetDictionary) {
          //     for (const [key, value] of Object.entries(head.morphTargetDictionary)) {
          //       gui
          //         .add(influences, value as number, 0, 1, 0.01)
          //         .name(key.replace('blendShape1.', ''))
          //         .listen();
          //     }
          //   }
          // }
        });

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = 2.5;
      controls.maxDistance = 5;
      controls.minAzimuthAngle = -Math.PI / 2;
      controls.maxAzimuthAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 1.8;
      controls.target.set(0, 0.15, -0.2);
      controlsRef.current = controls;

      const animate = () => {
        if (!isMounted) return;

        const delta = clock.getDelta();

        if (mixerRef.current) {
          mixerRef.current.update(delta);
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }

        if (controlsRef.current) {
          controlsRef.current.update();
        }
      };

      renderer.setAnimationLoop(animate);

      const handleResize = () => {
        if (!containerRef.current || !camera || !renderer) return;

        camera.aspect =
          containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    const cleanup = init();

    return () => {
      isMounted = false;

      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (mixerRef.current) {
        mixerRef.current = null;
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement.parentNode) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material?.dispose();
            }
          }
        });
        sceneRef.current = null;
      }

      cleanup.then((cleanupFn) => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`face-morph-container ${className || ''}`}
      style={style}
    />
  );
}

