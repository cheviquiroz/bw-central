// src/ui/BcfPanel/IssueList.tsx
import type { BcfTopic } from "../../viewer/bcf/types/bcf";
import { IssueCard } from "./IssueCard";

interface IssueListProps {
  topics: BcfTopic[];
  activeTopic: BcfTopic | null;
  onSelect: (topic: BcfTopic | null) => void;
  onActivate: (topic: BcfTopic) => void;
}

export function IssueList({ topics, activeTopic, onSelect, onActivate }: IssueListProps) {
  return (
    <div className="issue-list">
      {topics.length === 0 ? (
        <div className="issue-empty">Sin incidencias</div>
      ) : (
        topics.map((topic) => (
          <IssueCard
            key={topic.guid}
            topic={topic}
            isActive={activeTopic?.guid === topic.guid}
            onSelect={() => onSelect(topic)}
            onActivate={() => onActivate(topic)}
          />
        ))
      )}
    </div>
  );
}
