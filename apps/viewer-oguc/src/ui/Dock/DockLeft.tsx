// src/ui/Dock/DockLeft.tsx
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useApp } from "../AppContext";
import { DockPanel } from "./DockPanel";
import { DockHeader } from "./DockHeader";
import { DockCollapsed } from "./DockCollapsed";
import { ModelTree } from "./ModelTree";
import type { ModelDisplayNames, SelectionState } from "../../engine/createApplication";
import "../../styles/dock.css";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 272;
const COLLAPSE_THRESHOLD = 150; // por debajo de esto, mostrar DockCollapsed en vez del árbol
// Zona de "respiración": solo los últimos PROXIMITY_THRESHOLD px antes del
// borde del panel colapsado disparan la interpolación. Fuera de esa franja
// angosta, el panel se mantiene en reposo (56px) - evita que el dock
// reaccione con solo pasar el mouse cerca del viewport en general.
const PROXIMITY_THRESHOLD = 30;
const PANEL_LEFT = 16;
const PANEL_EDGE = PANEL_LEFT + COLLAPSED_WIDTH; // 72 - borde derecho del panel en reposo

export function DockLeft() {
  const app = useApp();
  const [isPinned, setIsPinned] = useState(false);
  const [width, setWidth] = useState(COLLAPSED_WIDTH);
  const [displayNames, setDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  const [selection, setSelection] = useState<SelectionState>(app.getSelection());
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const widthRef = useRef(width);
  widthRef.current = width;
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;
  const rafRef = useRef<number | null>(null);
  const pendingMouseXRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubNames = app.subscribeToModelDisplayNames(setDisplayNames);
    const unsubSelection = app.subscribeToSelection(setSelection);
    return () => {
      unsubNames();
      unsubSelection();
    };
  }, [app]);

  // Proximity listener: se re-lee en vivo en cada mousemove, pero evita dos
  // costos típicos de esta técnica -
  //  1) Nunca consulta el DOM (getBoundingClientRect) por evento: el borde
  //     del panel en reposo es un valor fijo (PANEL_EDGE, derivado de
  //     constantes CSS), así que la interpolación es aritmética pura.
  //  2) Batchea con requestAnimationFrame y descarta el cálculo si el ancho
  //     resultante no cambió en más de 1px, para no re-renderizar React en
  //     cada pixel de movimiento del mouse por toda la ventana (que es la
  //     mayoría del tiempo mientras se navega el modelo 3D, lejos del dock).
  // Además, la franja de reacción ahora es angosta (30px): fuera de ella el
  // early-return de "distancia > threshold" ni siquiera llega a comparar
  // contra el width actual, así que el costo real por evento lejos del
  // dock es una resta y una comparación.
  //
  // "Está sobre el panel" se deriva del ancho YA RENDERIZADO (widthRef),
  // no de un mouseenter/mouseleave nativo del DOM. Se probó la variante con
  // eventos nativos primero (tal como la pidió la spec) y se descartó: al
  // interpolar el ancho durante la aproximación, el panel crece y su borde
  // alcanza al cursor SIN que este se mueva - Chromium recalcula el estado
  // :hover tras el cambio de layout y dispara un mouseenter real, lo cual
  // encadenaba un salto a expansión completa para casi toda la franja de
  // 30px (confirmado con logging: a solo 23px del borde, ya auto-enganchaba
  // a 272px en vez de interpolar a ~106px). Anclar todo a un único cálculo
  // por mousemove evita ese loop de retroalimentación.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPinnedRef.current) return;
      pendingMouseXRef.current = e.clientX;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const mouseX = pendingMouseXRef.current;
        if (mouseX === null) return;

        const currentRightEdge = PANEL_LEFT + widthRef.current;
        const isOverPanel = mouseX >= PANEL_LEFT && mouseX <= currentRightEdge;

        let nextWidth: number;
        if (isOverPanel) {
          nextWidth = EXPANDED_WIDTH;
        } else {
          const distanceToEdge = Math.max(0, mouseX - PANEL_EDGE);
          if (distanceToEdge < PROXIMITY_THRESHOLD) {
            const proximityZone = PROXIMITY_THRESHOLD - distanceToEdge;
            nextWidth = Math.round(COLLAPSED_WIDTH + (proximityZone / PROXIMITY_THRESHOLD) * (EXPANDED_WIDTH - COLLAPSED_WIDTH));
          } else {
            nextWidth = COLLAPSED_WIDTH;
          }
        }

        if (Math.abs(nextWidth - widthRef.current) >= 1) {
          setWidth(nextWidth);
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPinned) setWidth(EXPANDED_WIDTH);
  }, [isPinned]);

  const handleAddClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setLoading(true);

    const succeeded: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        setProgressMessage(`Cargando "${file.name}" (${i + 1}/${fileList.length})...`);
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const result = await app.importNewModel(file.name, bytes, (progress) => {
          setProgressMessage(`"${file.name}": ${progress.statusMessage}`);
        });

        if (result.success) succeeded.push(file.name);
        else failed.push({ name: file.name, error: result.error });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al leer el archivo.";
        failed.push({ name: file.name, error: message });
        console.error(error);
      }
    }

    setLoading(false);
    event.target.value = "";

    const parts: string[] = [];
    if (succeeded.length > 0) parts.push(`✅ ${succeeded.join(", ")}`);
    if (failed.length > 0) parts.push(`❌ ${failed.map((f) => `${f.name} (${f.error})`).join("; ")}`);
    setProgressMessage(parts.join(" — "));

    if (parts.length > 0) {
      setTimeout(() => setProgressMessage(""), 5000);
    }
  };

  const headerVisible = width > 100;
  const showCollapsed = width < COLLAPSE_THRESHOLD;

  return (
    <DockPanel width={width}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <DockHeader
        visible={headerVisible}
        isPinned={isPinned}
        onAddClick={handleAddClick}
        onTogglePin={() => setIsPinned((v) => !v)}
      />

      {showCollapsed ? (
        <DockCollapsed displayNames={displayNames} selection={selection} onExpand={() => setIsPinned(true)} />
      ) : (
        <div className="dock-tree-content">
          {(loading || progressMessage) && (
            <p style={{ fontSize: "11px", color: "var(--dock-text-secondary)", padding: "0 20px 8px", whiteSpace: "normal" }}>
              {progressMessage || "Cargando..."}
            </p>
          )}
          <ModelTree />
        </div>
      )}
    </DockPanel>
  );
}
