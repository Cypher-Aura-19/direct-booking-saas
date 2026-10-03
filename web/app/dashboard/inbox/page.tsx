import { IconInbox } from "@/components/ui/icons";

export default function InboxIndexPage() {
  return (
    <div className="inbox-empty-detail">
      <span><IconInbox className="size-6" /></span>
      <p>Select a conversation to read it.</p>
    </div>
  );
}
