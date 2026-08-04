// src/ui/FileUploadModal/FileUploadModal.tsx
import { useRef, useState } from "react";
import type React from "react";
import "./file-upload-modal.css";

interface FileUploadModalProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export function FileUploadModal({ onFilesSelected, isLoading = false, error }: FileUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;

    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".ifc"));
    if (files.length > 0) await onFilesSelected(files);
  };

  const handleClick = () => {
    if (isLoading) return;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = "";
    if (files.length > 0) await onFilesSelected(files);
  };

  return (
    <>
      {/* Backdrop puro (blur + dim) - separado del cuadro a propósito: al ser
          position:fixed crea su propio stacking context, así que si viviera
          ACÁ ADENTRO quedaría atrapado a su mismo z-index sin importar qué
          z-index se le ponga por dentro. El cuadro necesita quedar en un
          contexto de apilamiento propio para poder pintarse por ENCIMA de
          Toolbar/Dock/PropertiesPanel (ver file-upload-modal.css). */}
      <div className="file-upload-modal-overlay" />
      <div className="file-upload-modal-stage">
        <div
          className={`file-upload-modal-dropzone${isDragging ? " dragging" : ""}${isLoading ? " loading" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".ifc"
            onChange={handleFileInputChange}
            style={{ display: "none" }}
          />

          {isLoading ? (
            <div className="file-upload-loading">
              <div className="spinner" />
              <p>Cargando modelo(s)...</p>
            </div>
          ) : error ? (
            <div className="file-upload-error">
              <p className="error-title">Error al cargar</p>
              <p className="error-message">{error}</p>
              <p className="upload-subtitle">Arrastra o haz clic para reintentar</p>
            </div>
          ) : (
            <div className="file-upload-content">
              <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2v20m-7-7l7-7 7 7M12 22H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v15a2 2 0 01-2 2z" />
              </svg>
              <h2 className="upload-title">Carga tu modelo IFC</h2>
              <p className="upload-subtitle">Arrastra o haz clic</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
