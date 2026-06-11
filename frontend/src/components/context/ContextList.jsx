import ContextItem from "./ContextItem";
import { useContextStore } from "../../store/contextStore";

export default function ContextList() {
  const { contexts } = useContextStore();
  return (
    <div className="space-y-3">
      {contexts.map((c) => (
        <ContextItem key={c.id} context={c} />
      ))}
    </div>
  );
}
