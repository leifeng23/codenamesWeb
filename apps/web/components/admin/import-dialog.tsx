"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import { TriangleAlert, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { Spinner } from "../ui/spinner";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Excel 导入确认弹窗：选文件后先确认替换范围，再真正上传。 */
export function ImportDialog({
  file,
  archives,
  pending,
  onConfirm,
  onCancel
}: {
  file: File | null;
  archives: WordArchiveNode[];
  pending: boolean;
  onConfirm: (archiveNames: string[]) => void;
  onCancel: () => void;
}) {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  // 每次打开时默认全选现有仓库（与旧行为一致）
  useEffect(() => {
    if (file) setSelectedNames(archives.map((archive) => archive.name));
  }, [file, archives]);

  return (
    <Modal
      open={file !== null}
      onClose={() => {
        if (!pending) onCancel();
      }}
      title="导入 Excel 词库"
      size="md"
      footer={
        <>
          <Button onClick={onCancel} disabled={pending}>
            取消
          </Button>
          <Button variant="danger" onClick={() => onConfirm(selectedNames)} disabled={pending}>
            {pending ? <Spinner size={16} /> : <Upload size={16} />}
            {pending ? "导入中…" : "确认导入并替换"}
          </Button>
        </>
      }
    >
      {file ? (
        <div className="mt-3 space-y-4 text-sm">
          <p className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70">
            📄 {file.name} <span className="text-white/40">（{formatSize(file.size)}）</span>
          </p>

          <div>
            <p className="font-semibold text-white/70">替换范围</p>
            <p className="mt-1 text-xs text-white/45">勾选的仓库将被清空，并由 Excel 中对应 Sheet 的内容替换。</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {archives.map((archive) => {
                const checked = selectedNames.includes(archive.name);
                return (
                  <label
                    key={archive.id}
                    className="flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-xs text-white/70"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending}
                      onChange={() =>
                        setSelectedNames((current) =>
                          checked ? current.filter((name) => name !== archive.name) : [...current, archive.name]
                        )
                      }
                    />
                    {archive.name}
                  </label>
                );
              })}
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-md border border-ember/25 bg-ember/[0.06] px-3 py-2 text-xs text-ember/90">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            此操作不可撤销：勾选仓库下的现有分类与词条会被永久替换。未勾选的仓库不受影响；Excel 里的新 Sheet 会自动创建为新仓库。
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
