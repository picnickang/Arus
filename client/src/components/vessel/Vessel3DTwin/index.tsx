/**
 * Push A3 — Three.js viewer for a vessel glTF model.
 *
 * - Lazy-imported by `/vessels/:id/3d` so Three.js is not in the main bundle.
 * - Camera: OrbitControls (mouse / touch).
 * - Equipment pins: sprites positioned from the model's pin metadata.
 * - Health colours: green/amber/red based on `healthByEquipmentId` prop.
 * - Click a pin → fires `onSelectEquipment(equipmentId)`. The parent loads
 *   the Push A2 dependency graph and feeds downstream IDs back via
 *   `highlightedEquipmentIds` so those pins tint amber in-scene. A separate
 *   "Open detail" action navigates to `/equipment` so the 3D overlay stays
 *   on screen while the operator inspects it.
 * - Replay: `healthByEquipmentId` is recomputed by the parent from
 *   `TwinStateService.getStateHistory()` snapshots as the scrubber moves;
 *   this component just re-tints pins from that map.
 *
 * Three.js is heavy — the parent must lazy-load this module.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EquipmentPin } from "@shared/schema";

export type HealthMap = Record<string, number | undefined>;

export interface Vessel3DTwinProps {
  modelUrl: string;
  pins: EquipmentPin[];
  healthByEquipmentId: HealthMap;
  highlightedEquipmentIds?: string[]; // dependency-overlay tint
  onSelectEquipment?: (equipmentId: string) => void;
}

function healthToColor(h: number | undefined, highlighted: boolean): string {
  if (highlighted) return "#f59e0b"; // amber (downstream impact)
  if (h === undefined) return "#94a3b8"; // slate (unknown)
  if (h >= 70) return "#22c55e"; // green
  if (h >= 40) return "#eab308"; // yellow
  return "#ef4444"; // red
}

function makePinSprite(color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.6, 0.6, 0.6);
  return sprite;
}

export default function Vessel3DTwin({
  modelUrl,
  pins,
  healthByEquipmentId,
  highlightedEquipmentIds = [],
  onSelectEquipment,
}: Vessel3DTwinProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pinGroupRef = useRef<THREE.Group | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Boot scene exactly once per modelUrl change.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1220");

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(8, 6, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    pinGroupRef.current = pinGroup;

    // Raycaster for pin click-through.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function handleClick(ev: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pinGroup.children, false);
      if (hits.length > 0) {
        const data = hits[0].object.userData as { equipmentId?: string };
        if (data.equipmentId && onSelectEquipment) onSelectEquipment(data.equipmentId);
      }
    }
    renderer.domElement.addEventListener("click", handleClick);

    const loader = new GLTFLoader();
    let disposed = false;
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        scene.add(gltf.scene);
        // Frame the model.
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3()).length() || 10;
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(size * 0.8, size * 0.6, size * 1.0));
        camera.near = size / 100;
        camera.far = size * 100;
        camera.updateProjectionMatrix();
        setStatus("ready");
      },
      undefined,
      (err) => {
        setError((err as Error).message || "Failed to load model");
        setStatus("error");
      }
    );

    let frame = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    function handleResize() {
      const w = mount!.clientWidth || 800;
      const h = mount!.clientHeight || 500;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      pinGroupRef.current = null;
    };
  }, [modelUrl, onSelectEquipment]);

  // Re-render pins whenever inputs change.
  useEffect(() => {
    const group = pinGroupRef.current;
    if (!group) return;
    // Clear existing.
    while (group.children.length) {
      const c = group.children.pop()!;
      const sprite = c as THREE.Sprite;
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    const highlighted = new Set(highlightedEquipmentIds);
    for (const pin of pins) {
      const colour = healthToColor(healthByEquipmentId[pin.equipmentId], highlighted.has(pin.equipmentId));
      const sprite = makePinSprite(colour);
      sprite.position.set(pin.x, pin.y, pin.z);
      sprite.userData.equipmentId = pin.equipmentId;
      group.add(sprite);
    }
  }, [pins, healthByEquipmentId, highlightedEquipmentIds]);

  return (
    <div className="relative w-full h-full min-h-[500px]" data-testid="vessel-3d-viewer">
      <div ref={mountRef} className="w-full h-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading 3D model…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-500" data-testid="text-vessel-3d-error">
          {error ?? "Failed to load model"}
        </div>
      )}
    </div>
  );
}
