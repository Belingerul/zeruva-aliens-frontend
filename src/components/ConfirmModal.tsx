"use client";

import { ReactNode } from "react";

export default function ConfirmModal({
  open,
  title,
  subtitle,
  children,
  primaryText,
  primaryDisabled,
  onPrimary,
  secondaryText = "Cancel",
  secondaryDisabled,
  onSecondary,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  primaryText: string;
  primaryDisabled?: boolean;
  onPrimary: () => void | Promise<void>;
  secondaryText?: string;
  secondaryDisabled?: boolean;
  onSecondary: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onSecondary}
      />
      <div className="relative w-full max-w-xl rounded-2xl border border-gray-800 bg-black/80 backdrop-blur p-6 text-white">
        <div className="text-2xl font-bold">{title}</div>
        {subtitle && <div className="text-sm text-gray-400 mt-1">{subtitle}</div>}

        {children && <div className="mt-5">{children}</div>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {primaryText}
          </button>
          <button
            onClick={onSecondary}
            disabled={secondaryDisabled}
            className="px-4 py-3 rounded-lg border border-gray-700 text-gray-200 disabled:opacity-50"
          >
            {secondaryText}
          </button>
        </div>
      </div>
    </div>
  );
}
