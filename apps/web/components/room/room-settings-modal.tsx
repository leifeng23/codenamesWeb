"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { CategoryTree } from "../category-tree";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Modal } from "../ui/modal";

/** 房主专属设置弹窗：题库设置 + 危险操作（解散房间）。 */
export function RoomSettingsModal({
  open,
  onClose,
  roomCode,
  categoryTree,
  selectedCategoryIds,
  onChangeCategories,
  onSaveCategories,
  onDisband
}: {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  categoryTree: WordArchiveNode[];
  selectedCategoryIds: string[];
  onChangeCategories: (next: string[]) => void;
  onSaveCategories: () => void;
  onDisband: () => void;
}) {
  const [confirmDisband, setConfirmDisband] = useState(false);

  return (
    <>
      <Modal open={open} onClose={onClose} title="房间设置" size="md" showClose>
        <div className="mt-4">
          <p className="text-sm font-semibold text-white/70">题库设置</p>
          <div className="mt-2">
            <CategoryTree tree={categoryTree} selected={selectedCategoryIds} onChange={onChangeCategories} />
          </div>
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={() => {
              onSaveCategories();
              onClose();
            }}
          >
            保存题库设置
          </Button>
        </div>

        <div className="mt-6 rounded-lg border border-ember/25 p-3">
          <p className="text-sm font-bold text-white/70">危险操作</p>
          <p className="mt-1 text-xs text-white/45">解散后房间、对局与记录将被永久删除，所有成员会被移出。</p>
          <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirmDisband(true)}>
            <Trash2 size={16} />
            解散房间
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDisband}
        title={
          <>
            <Trash2 size={20} /> 解散房间？
          </>
        }
        body={`房间 ${roomCode} 及其全部对局、翻牌记录将被永久删除，无法恢复。所有成员会被移出房间。`}
        confirmLabel="确认解散"
        tone="danger"
        onCancel={() => setConfirmDisband(false)}
        onConfirm={() => {
          setConfirmDisband(false);
          onDisband();
        }}
      />
    </>
  );
}
