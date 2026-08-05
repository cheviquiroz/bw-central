// src/viewer/bcf/types/bcf.ts

export interface BcfVector3 {
  x: number;
  y: number;
  z: number;
}

export interface BcfViewpoint {
  guid: string;
  camera: {
    position: BcfVector3;
    direction: BcfVector3;
    up: BcfVector3;
  };
  clippingPlane?: {
    location: BcfVector3;
    direction: BcfVector3;
  };
  snapshot?: string; // data URI (data:image/png;base64,...), no solo el base64 crudo - así se puede usar directo en <img src>
}

export interface BcfComment {
  guid: string;
  author: string;
  date: string;
  text: string;
  replyToGuid?: string;
}

export type BcfPriority = "Low" | "Medium" | "High";
export type BcfStatus = "Open" | "Pending Review" | "Resolved";

export interface BcfTopic {
  guid: string;
  title: string;
  description: string;
  createdAuthor: string;
  createdDate: string;
  priority: BcfPriority;
  status: BcfStatus;
  assignee?: string;
  viewpoint: BcfViewpoint;
  comments: BcfComment[];
  markup?: {
    snapshots?: string[]; // base64
    svg?: string;
  };
}

export interface BcfProject {
  guid: string;
  name: string;
  topics: BcfTopic[];
  // Pass-through de VersionId (ver @bw-central/bcf-core) - el estándar BCF
  // no está limitado a "2.0"/"2.1"/"3.0" en la práctica, y este campo no se
  // usa para ninguna decisión de UI, solo se reescribe tal cual al exportar.
  version: string;
}

export type BcfFilterStatus = "All" | BcfStatus;

// Snapshot inmutable expuesto por BcfManager.getState()/subscribe() - ver
// BcfManager.ts para el porqué de este shape (pub/sub real, no mutación
// muda de un objeto interno).
export interface BcfManagerState {
  project: BcfProject | null;
  topics: BcfTopic[];
  activeTopic: BcfTopic | null;
  filters: { status: BcfFilterStatus };
}
