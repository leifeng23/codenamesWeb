"use client";

import { Loader2 } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "default",
  pending = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onCancel();
      }}
      title={title}
      tone={tone}
      footer={
        <>
          <Button onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body ? <div className="mt-2 text-sm text-white/60">{body}</div> : null}
    </Modal>
  );
}
