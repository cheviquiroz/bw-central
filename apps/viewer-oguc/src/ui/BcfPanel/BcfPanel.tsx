// src/ui/BcfPanel/BcfPanel.tsx
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import { usePanelWidth } from "../PanelWidthContext";
import { IconLock } from "../icons/dock";
import { IssueList } from "./IssueList";
import { FilterBar } from "./FilterBar";
import "./bcf-panel.css";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 320;
const COLLAPSE_THRESHOLD = 150;
const PROXIMITY_THRESHOLD = 30;
const PANEL_RIGHT_BASE = 16; // igual que .properties-panel
const PANEL_GAP = 8; // separación visual entre BcfPanel y PropertiesPanel

interface BcfPanelProps {
  state: BcfManagerState;
  onFilterChange: (status: BcfFilterStatus) => void;
  onTopicSelect: (topic: BcfTopic | null) => void;
  onTopicActivate: (topic: BcfTopic) => void;
}

export function BcfPanel({ state, onFilterChange, onTopicSelect, onTopicActivate }: BcfPanelProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [width, setWidth] = useState(COLLAPSED_WIDTH);
  const panelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setBcfPanelWidth } = usePanelWidth();

  // BcfPanel cuelga a la izquierda de PropertiesPanel (ambos anclados al
  // borde derecho) - su propio "right" es dinámico, no una constante como
  // en PropertiesPanel/DockLeft. Se guarda en un ref (no en el cálculo del
  // handler) para no tener que recrear el listener de mousemove cada vez
  // que panelWidth cambia mientras el usuario hueverea cerca del borde.
  const panelRight = PANEL_RIGHT_BASE + panelWidth + PANEL_GAP;
  const panelRightRef = useRef(panelRight);
  panelRightRef.current = panelRight;

  const widthRef = useRef(width);
  widthRef.current = width;
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;
  const rafRef = useRef<number | null>(null);
  const pendingMouseXRef = useRef<number | null>(null);

  // Publica el propio ancho para que OrientationCube pueda correrse más a
  // la izquierda todavía (más allá de PropertiesPanel) - ver
  // PanelWidthContext.tsx/OrientationCube.tsx.
  useEffect(() => {
    setBcfPanelWidth(width);
  }, [width, setBcfPanelWidth]);

  // Mismo proximity-hover que PropertiesPanel.tsx (rAF-batched, umbral de
  // 1px, lee e.clientX de verdad) - la única diferencia real es que acá el
  // "borde de reposo" del panel (panelRightRef.current) es dinámico, no una
  // constante, porque depende del ancho actual de PropertiesPanel.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPinnedRef.current) return;
      pendingMouseXRef.current = e.clientX;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const mouseX = pendingMouseXRef.current;
        if (mouseX === null) return;

        const right = panelRightRef.current;
        const distanceFromRight = window.innerWidth - mouseX;
        const currentLeftEdgeFromRight = right + widthRef.current;
        const isOverPanel = distanceFromRight >= right && distanceFromRight <= currentLeftEdgeFromRight;

        let nextWidth: number;
        if (isOverPanel) {
          nextWidth = EXPANDED_WIDTH;
        } else {
          const edgeFromRight = right + COLLAPSED_WIDTH;
          const distanceToEdge = Math.max(0, distanceFromRight - edgeFromRight);
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

  const isCollapsed = width < COLLAPSE_THRESHOLD;
  const filteredTopics =
    state.filters.status === "All" ? state.topics : state.topics.filter((t) => t.status === state.filters.status);

  return (
    <div
      ref={panelRef}
      className={`bcf-panel${isCollapsed ? " collapsed" : ""}`}
      style={{ "--bcf-panel-width": `${width}px`, right: `${panelRight}px` } as CSSProperties}
    >
      <div className="bcf-header">
        <h3 className="bcf-title">{isCollapsed ? "BCF" : "BCF Issues"}</h3>
        <button
          className={`bcf-pin-btn${isPinned ? " active" : ""}`}
          onClick={() => setIsPinned((v) => !v)}
          title={isPinned ? "Desfijar panel" : "Fijar panel"}
        >
          <IconLock />
        </button>
      </div>

      <FilterBar
        filter={state.filters.status}
        topicsCount={state.topics.length}
        filteredCount={filteredTopics.length}
        onFilterChange={onFilterChange}
      />

      <IssueList topics={filteredTopics} activeTopic={state.activeTopic} onSelect={onTopicSelect} onActivate={onTopicActivate} />
    </div>
  );
}
