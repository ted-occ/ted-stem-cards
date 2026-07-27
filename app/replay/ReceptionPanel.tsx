"use client";

import { useI18n } from "@/lib/i18n";
import { ReceptionInfo, formatSlotKey } from "@/lib/reception";

interface ReceptionPanelProps {
  reception: ReceptionInfo | null;
}

// 氏名はURLクエリに由来し誰でも書き換えられるため、この画面は本人確認や
// チェックイン済みの証明としては使わない(表示のみの参加者向け案内)。
const NAME_DISPLAY_MAX_LENGTH = 40;

export default function ReceptionPanel({ reception }: ReceptionPanelProps) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#0d0d14] p-4">
      <div className="mx-4 flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl">
        {reception ? (
          <>
            <h1 className="text-xl font-bold text-gray-800">{t("receptionTitle")}</h1>

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("receptionTicket")}
              </span>
              <span className="text-6xl font-bold tracking-tight text-gray-900">
                {reception.ticketNumber}
              </span>
            </div>

            {reception.name && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t("receptionName")}
                </span>
                <span className="text-xl font-medium text-gray-800">
                  {reception.name.slice(0, NAME_DISPLAY_MAX_LENGTH)}
                </span>
              </div>
            )}

            <span className="rounded-full bg-blue-50 px-4 py-1 text-sm font-medium text-blue-600">
              {t("receptionSlot")}: {formatSlotKey(reception.slotKey)}
            </span>

            <p className="mt-2 text-center text-sm text-gray-600">{t("receptionGuide")}</p>
            <p className="text-center text-xs text-gray-400">{t("receptionNote")}</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-lg font-bold text-gray-800">{t("noProgram")}</p>
            <p className="text-sm text-gray-500">{t("noProgramHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
